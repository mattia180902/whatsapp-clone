import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatListComponent } from '../../components/chat-list/chat-list.component';
import {
  ChatResponse,
  MessageRequest,
  MessageResponse,
} from '../../services/models';
import { ChatService, MessageService } from '../../services/services';
import { KeycloakService } from '../../utils/keycloak/keycloak.service';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { EmojiData } from '@ctrl/ngx-emoji-mart/ngx-emoji';
import * as Stomp from 'stompjs';
import SockJS from 'sockjs-client';
import { Notification } from './notification';

@Component({
  standalone: true,
  selector: 'app-main',
  imports: [ChatListComponent, DatePipe, PickerComponent, FormsModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit, OnDestroy, AfterViewChecked{

  chats: Array<ChatResponse> = [];
  selectedChat: ChatResponse = {};
  chatMessages: MessageResponse[] = [];
  showEmojis = false;
  messageContent = '';
  socketClient: any = null;
  @ViewChild("scrollableDiv") scrollableDiv!: ElementRef<HTMLDivElement>;
  private notificationSubscription: any;

  constructor(
    private chatService: ChatService,
    private keycloakService: KeycloakService,
    private messageService: MessageService
  ) {}

  ngAfterViewChecked(): void {
    this.scrollBotttom();
  }

  ngOnDestroy(): void {
    if (this.socketClient !== null) {
      this.socketClient.disconnect(),
        this.notificationSubscription.unsubscribe();
      this.socketClient = null;
    }
  }

  ngOnInit(): void {
    this.initWebSocket();
    this.getAllChats();
  }

  initWebSocket() {
    if (this.keycloakService.keycloak.tokenParsed?.sub) {
      let ws = new SockJS('http://localhost:8080/ws');
      this.socketClient = Stomp.over(ws);
      const subUrl = `/user/${this.keycloakService.keycloak.tokenParsed?.sub}/chat`;
      this.socketClient.connect(
        { Authorization: 'Bearer ' + this.keycloakService.keycloak.token },
        () => {
          this.notificationSubscription = this.socketClient.subscribe(
            subUrl,
            (message: any) => {
              const notification: Notification = JSON.parse(message.body);

              this.handleNotification(notification);
            },
            () => {
              console.error('Error while connecting to webSocket');
            }
          );
        }
      );
    }
  }

  private handleNotification(notification: Notification) {
    if (!notification) return;
    if (this.selectedChat && this.selectedChat.id === notification.chatId) {
      switch (notification.type) {
        case 'MESSAGE':
        case 'IMAGE':
          const message: MessageResponse = {
            senderId: notification.senderId,
            receiverId: notification.receiverId,
            content: notification.content,
            type: notification.messageType,
            media: notification.media,
            createdAt: new Date().toString(),
          };
          if (notification.type === 'IMAGE') {
            this.selectedChat.lastMessage = 'Attachment';
          } else {
            this.selectedChat.lastMessage = notification.content;
          }
          this.chatMessages.push(message);
          break;
        case 'SEEN':
          this.chatMessages.forEach((m) => (m.state = 'SEEN'));
          break;
      }
    } else {
      const destChat = this.chats.find((c) => c.id === notification.chatId);
      if (destChat && notification.type !== 'SEEN') {
        if (notification.type === 'MESSAGE') {
          destChat.lastMessage = notification.content;
        } else if (notification.type === 'IMAGE') {
          destChat.lastMessage = 'Attachment';
        }
        destChat.lastMessageTime = new Date().toString();
        destChat.unreadCount! += 1;
      } else if (notification.type === 'MESSAGE') {
        const newChat: ChatResponse = {
          id: notification.chatId,
          senderId: notification.senderId,
          receiverId: notification.receiverId,
          lastMessage: notification.content,
          name: notification.chatName,
          unreadCount: 1,
          lastMessageTime: new Date().toString(),
        };
        this.chats.unshift(newChat);
      }
    }
  }

  private getAllChats() {
    this.chatService.getChatsByReceiver().subscribe({
      next: (res) => {
        this.chats = res;
      },
    });
  }

  userProfile() {
    this.keycloakService.accountManagement();
  }
  logout() {
    this.keycloakService.logout();
  }
  chatSelected(chatResponse: ChatResponse) {
    this.selectedChat = chatResponse;
    this.getAllChatMessages(chatResponse.id as string);
    this.setMessagesToSeen();
    this.selectedChat.unreadCount = 0;
  }

  getAllChatMessages(chatId: string) {
    this.messageService
      .getMessages({
        'chat-id': chatId,
      })
      .subscribe({
        next: (messages) => {
          this.chatMessages = messages;
        },
      });
  }

  setMessagesToSeen() {
    this.messageService
      .setMessagesToSeen({
        'chat-id': this.selectedChat.id as string,
      })
      .subscribe({
        next: () => {},
      });
  }

  isSelfMessage(message: MessageResponse) {
    return message.senderId === this.keycloakService.userId;
  }

  uploadMedia(target: EventTarget | null) {
    const file = this.extractFileFromTarget(target);
    if (file !== null) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {

          const mediaLines = reader.result.toString().split(',')[1];

          this.messageService.uploadMedia({
            'chat-id': this.selectedChat.id as string,
            body: {
              file: file
            }
          }).subscribe({
            next: () => {
              const message: MessageResponse = {
                senderId: this.getSenderId(),
                receiverId: this.getReceiverId(),
                content: 'Attachment',
                type: 'IMAGE',
                state: 'SENT',
                media: [mediaLines],
                createdAt: new Date().toString()
              };
              this.chatMessages.push(message);
            }
          });
        }
      }
      reader.readAsDataURL(file);
    }
  }

  extractFileFromTarget(target: EventTarget | null): File | null {
    const htmlInputTarget = target as HTMLInputElement;
    if (target === null || htmlInputTarget.files === null) {
      return null;
    }
    return htmlInputTarget.files[0];
  }

  onSelectEmojis(emojiSelected: any) {
    const emoji: EmojiData = emojiSelected.emoji;
    this.messageContent += emoji.native;
  }

  sendMessage() {
    if (this.messageContent) {
      const messageRequest: MessageRequest = {
        chatId: this.selectedChat.id,
        senderId: this.getSenderId(),
        receiverId: this.getReceiverId(),
        content: this.messageContent,
        type: 'TEXT',
      };
      this.messageService
        .saveMessage({
          body: messageRequest,
        })
        .subscribe({
          next: () => {
            const message: MessageResponse = {
              senderId: this.getSenderId(),
              receiverId: this.getReceiverId(),
              content: this.messageContent,
              type: 'TEXT',
              state: 'SENT',
              createdAt: new Date().toString(),
            };
            this.selectedChat.lastMessage = this.messageContent;
            this.chatMessages.push(message);
            this.messageContent = '';
            this.showEmojis = false;
          },
        });
    }
  }

  private getSenderId(): string {
    if (this.selectedChat.senderId === this.keycloakService.userId) {
      return this.selectedChat.senderId as string;
    }
    return this.selectedChat.receiverId as string;
  }

  private getReceiverId(): string {
    if (this.selectedChat.senderId === this.keycloakService.userId) {
      return this.selectedChat.receiverId as string;
    }
    return this.selectedChat.senderId as string;
  }

  keyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage();
    }
  }

  onClick() {
    this.setMessagesToSeen();
  }

  private scrollBotttom() {
    if (this.scrollableDiv) {
      const div = this.scrollableDiv.nativeElement;
      div.scrollTop = div.scrollHeight;
    }
  }
}

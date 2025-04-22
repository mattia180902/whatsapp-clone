import { Component, input, InputSignal } from '@angular/core';
import { ChatResponse, UserResponse } from '../../services/models';
import { DatePipe } from '@angular/common';
import { UserService } from '../../services/services';

@Component({
  standalone: true,
  selector: 'app-chat-list',
  imports: [DatePipe],
  templateUrl: './chat-list.component.html',
  styleUrl: './chat-list.component.scss',
})
export class ChatListComponent {
selectContact(_t34: UserResponse) {
throw new Error('Method not implemented.');
}

  chats: InputSignal<ChatResponse[]> = input<ChatResponse[]>([]);

  searchNewContact: boolean = false;
  contacts: Array<UserResponse> = [];

  constructor(
    private userService: UserService
  ) {}

  wrapMessage(lastMessage: string | undefined): string {
    if (lastMessage && lastMessage.length <= 20) {
      return lastMessage;
    }
    return lastMessage?.substring(0, 17) + '...';
  }

  chatClicked(_t16: ChatResponse) {
    throw new Error('Method not implemented.');
  }

  searchContact() {
    this.userService.getAllUsers()
      .subscribe({
        next: (users) => {
          this.contacts = users;
          this.searchNewContact = true;
        }
      })
  }
}

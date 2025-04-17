package com.sincon.whatsappclone.message;

import org.springframework.stereotype.Service;

import com.sincon.whatsappclone.file.FileUtils;

@Service
public class MessageMapper {

    public MessageResponse toMessageResponse(Message message) {
        return MessageResponse.builder()
        .id(message.getId())
        .content(message.getContent())
        .senderId(message.getSenderId())
        .receiverId(message.getReceiverId())
        .type(message.getType())
        .createdAt(message.getCreatedDate())
        .media(FileUtils.readFileFromLocation(message.getMediaFilePath()))
        .build();
    }
}

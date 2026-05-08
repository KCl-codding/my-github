package com.example.circlemessage.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.Message;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

public interface MessageService extends IService<Message> {

    Boolean sendMessage(Message message);

    List<Message> getMessage(String openid, String receiver, LocalDateTime time);

    Boolean recalledMessage(Message message);

    Set<String> getWhoChat(String openid);

    Map<String, Message> getLastMessageByEachSender(String openid,List<String> openidList);

    Map<String ,List<Message>> getOfflineMessage(String openid);
}

package com.example.circlemessage.controller;

import com.example.circlemessage.entity.Message;
import com.example.circlemessage.service.MessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/message")
public class MessageController {
    @Autowired
    private MessageService messageService;

    @PostMapping("/get_message")
    public List<Message> getMessage(@RequestParam("openid")String openid,
                                    @RequestParam("receiver")String receiver,
                                    @RequestParam(required = false) LocalDateTime time){
        return messageService.getMessage(openid,receiver,time);
    }
    @PostMapping("/recalled_message")
    public Boolean recalledMessage(@RequestBody Message message){
        return messageService.recalledMessage(message);
    }
    @PostMapping("/get_who_chat")
    public Set<String> getWhoChat(@RequestParam("openid")String openid){
        return messageService.getWhoChat(openid);
    }
    @PostMapping("/get_last_chat/{openid}")
    public Map<String, Message> getLastChat(@PathVariable("openid")String openid,
                                            @RequestBody List<String> openidList){
        return messageService.getLastMessageByEachSender(openid,openidList);
    }
    @PostMapping("/get_offline_chat")
    public Map<String,List<Message>> getOfflineMessage(@RequestParam("openid")String openid){
        return messageService.getOfflineMessage(openid);
    }
}

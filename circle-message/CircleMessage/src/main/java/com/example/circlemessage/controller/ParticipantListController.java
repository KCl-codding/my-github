package com.example.circlemessage.controller;

import com.example.circlemessage.service.activity.ParticipantListService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/join")
public class ParticipantListController {

    @Autowired
    private ParticipantListService participantListService;

    @PostMapping("/get_join")
    public Integer getJoinCount(@RequestParam("participant") String participant) {
        return participantListService.getJoinCount(participant);
    }
    @PostMapping("/get_join_openid")
    public List<String> getJoinOpenid(@RequestParam("participant") String participant){
        return participantListService.joinOpenid(participant);
    }
}

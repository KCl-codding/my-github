package com.example.circlemessage.service.activity;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.activity.ParticipantList;

import java.util.List;

public interface ParticipantListService extends IService<ParticipantList> {

    Integer getJoinCount(String participant);

    String joinActivity(ParticipantList participantList);

    List<String> joinOpenid(String participant);

    String exitActivity(ParticipantList participantList);
}

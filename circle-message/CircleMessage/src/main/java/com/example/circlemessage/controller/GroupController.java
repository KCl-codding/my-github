package com.example.circlemessage.controller;

import com.example.circlemessage.entity.group.GroupInfo;
import com.example.circlemessage.entity.group.GroupMessage;
import com.example.circlemessage.service.group.GroupInfoService;
import com.example.circlemessage.service.group.GroupMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/group")
public class GroupController {
    @Autowired
    private GroupInfoService groupInfoService;

    @Autowired
    private GroupMessageService groupMessageService;

    @PostMapping("/get_openid_group")
    public List<GroupInfo> getOpenIdGroup(@RequestParam("openid") String openid) {
        return groupInfoService.getGroupInfo(openid);
    }
    @PostMapping("/get_one_group")
    public List<GroupMessage> getOneGroupMessage(@RequestParam("groupUuid") String groupUuid) {
        return groupMessageService.getOneGroupMessage(groupUuid);
    }
    @PostMapping("/get_last_group_message")
    public List<GroupMessage> getLastGroupMessage(@RequestBody List<String> groupUuid){
        return groupMessageService.getLastGroupMessage(groupUuid);
    }
}

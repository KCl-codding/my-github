package com.example.circlemessage.service.impl.group;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.entity.group.GroupInfo;
import com.example.circlemessage.entity.group.GroupMember;
import com.example.circlemessage.entity.group.GroupMessage;
import com.example.circlemessage.mapper.gruop.GroupMapper;
import com.example.circlemessage.service.group.GroupMemberService;
import com.example.circlemessage.service.group.GroupInfoService;
import com.example.circlemessage.service.group.GroupMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.xml.crypto.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class GroupInfoServiceImpl
        extends ServiceImpl<GroupMapper, GroupInfo>
        implements GroupInfoService {

    @Autowired
    private GroupMemberService groupMemberService;
    @Autowired
    private GroupMessageService groupMessageService;

    @Override
    public GroupInfo saveGroup(GroupInfo groupInfo,String fromId) {
        // 1. 生成群组UUID
        String groupUuid = UUID.randomUUID().toString().replace("-", "");
        groupInfo.setGroupUuid(groupUuid);

        for (GroupMember groupMember : groupInfo.getGroupMembers()) {
            groupMember.setGroupUuid(groupUuid);
        }
        // 一次性批量插入所有群成员
        groupMemberService.saveBatch(groupInfo.getGroupMembers());

        GroupMessage groupMessage = new GroupMessage();
        groupMessage.setSenderOpenid(fromId);
        groupMessage.setContent("欢迎参加我的活动~");
        groupMessage.setGroupUuid(groupUuid);
        groupMessage.setSendTime(LocalDateTime.now());
        groupMessageService.sendGroupMessage(groupMessage);
        this.save(groupInfo);
        return groupInfo;
    }

    @Override
    public List<GroupInfo> getGroupInfo(String openid) {
        List<String> groupUuids = groupMemberService.getGroupUuid(openid);
        if (groupUuids.isEmpty()) {
            return new ArrayList<>();
        }
        LambdaQueryWrapper<GroupInfo> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.in(GroupInfo::getGroupUuid, groupUuids);
        List<GroupInfo> list = this.list(queryWrapper);
        for (GroupInfo groupInfo : list) {
            groupInfo.setGroupMembers(groupMemberService
                    .getGroupMemberByGroupUuid(groupInfo.getGroupUuid()));
        }
        return list;
    }
}
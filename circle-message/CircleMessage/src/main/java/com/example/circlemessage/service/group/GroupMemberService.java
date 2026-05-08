package com.example.circlemessage.service.group;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.group.GroupMember;

import java.util.List;

public interface GroupMemberService extends IService<GroupMember> {
    Boolean saveGroupMember(GroupMember groupMember);

    List<String> getGroupUuid(String openid);

    List<GroupMember> getGroupMemberByGroupUuid(String groupUuid);

    List<String> getGroupOpenid(String groupUuid);
}

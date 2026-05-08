package com.example.circlemessage.service.group;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.group.GroupInfo;

import java.util.List;

public interface GroupInfoService extends IService<GroupInfo> {
    GroupInfo saveGroup(GroupInfo groupInfo,String fromId);

    List<GroupInfo> getGroupInfo(String openid);
}

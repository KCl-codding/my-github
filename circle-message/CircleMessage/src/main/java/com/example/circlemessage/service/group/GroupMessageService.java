package com.example.circlemessage.service.group;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.group.GroupMessage;

import java.util.List;

public interface GroupMessageService extends IService<GroupMessage> {

    Long sendGroupMessage(GroupMessage groupMessage);

    List<GroupMessage> getOneGroupMessage(String groupUuid);

    Boolean recallGroupMessage(String id);

    List<GroupMessage> getLastGroupMessage(List<String> groupUuid);
}

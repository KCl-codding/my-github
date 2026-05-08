package com.example.circlemessage.service.impl.group;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.entity.group.GroupMessage;
import com.example.circlemessage.mapper.gruop.GroupMessageMapper;
import com.example.circlemessage.service.group.GroupMessageService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class GroupMessageServiceImpl
        extends ServiceImpl<GroupMessageMapper, GroupMessage>
        implements GroupMessageService {
    @Override
    public Long sendGroupMessage(GroupMessage groupMessage) {
        this.save(groupMessage);  // 保存后，雪花ID会自动回填到groupMessage对象中
        return groupMessage.getId();  // 返回回填后的ID
    }

    @Override
    public List<GroupMessage> getOneGroupMessage(String groupUuid) {
        LambdaQueryWrapper<GroupMessage> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(GroupMessage::getGroupUuid, groupUuid);
        return this.list(queryWrapper);
    }

    @Override
    public Boolean recallGroupMessage(String id) {
        LambdaUpdateWrapper<GroupMessage> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(GroupMessage::getId, id)
                .set(GroupMessage::getIsRecalled, true);
        return this.update(updateWrapper);
    }

    @Override
    public List<GroupMessage> getLastGroupMessage(List<String> groupUuids) {
        if (groupUuids == null || groupUuids.isEmpty()) {
            return new ArrayList<>();
        }

        // 去重
        List<String> distinctGroupUuids = groupUuids.stream()
                .distinct()
                .collect(Collectors.toList());

        // 查询所有相关群组的消息
        LambdaQueryWrapper<GroupMessage> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.in(GroupMessage::getGroupUuid, distinctGroupUuids)
                .orderByDesc(GroupMessage::getSendTime);

        List<GroupMessage> allMessages = this.list(queryWrapper);

        // 使用 Map 记录每个群组的最新消息
        Map<String, GroupMessage> lastMessageMap = new HashMap<>();
        for (GroupMessage message : allMessages) {
            String groupUuid = message.getGroupUuid();
            if (!lastMessageMap.containsKey(groupUuid)) {
                lastMessageMap.put(groupUuid, message);
            }
        }

        // 按原始顺序返回结果
        List<GroupMessage> result = new ArrayList<>();
        for (String groupUuid : distinctGroupUuids) {
            GroupMessage lastMessage = lastMessageMap.get(groupUuid);
            if (lastMessage != null) {
                result.add(lastMessage);
            }
        }

        return result;
    }
}

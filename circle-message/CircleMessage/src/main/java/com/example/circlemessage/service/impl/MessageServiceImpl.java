package com.example.circlemessage.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.config.DynamicTableContext;
import com.example.circlemessage.entity.Message;
import com.example.circlemessage.mapper.MessageMapper;
import com.example.circlemessage.service.MessageService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MessageServiceImpl
        extends ServiceImpl<MessageMapper, Message>
        implements MessageService {

    @Override
    public Boolean sendMessage(Message message) {
        LocalDateTime sendTime = message.getSendTime() == null ? LocalDateTime.now() : message.getSendTime();
        try {
            DynamicTableContext.setTime(sendTime);
            return this.save(message);
        } finally {
            DynamicTableContext.clear();
        }
    }

    @Override
    public List<Message> getMessage(String openid, String receiver, LocalDateTime time) {
        try {
            LocalDateTime queryTime = (time == null) ? LocalDateTime.now() : time;
            DynamicTableContext.setTime(queryTime);

            LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<>();

            // 查询两个人的所有聊天记录（包括已读、已撤回等）
            wrapper.and(wrapper1 -> wrapper1
                            .eq(Message::getSenderOpenid, openid)
                            .eq(Message::getReceiverOpenid, receiver)
                            .or()
                            .eq(Message::getSenderOpenid, receiver)
                            .eq(Message::getReceiverOpenid, openid)
                    )
                    .orderByAsc(Message::getSendTime);  // 按发送时间升序排列

            return this.list(wrapper);
        } finally {
            DynamicTableContext.clear();
        }
    }
    @Override
    public Boolean recalledMessage(Message recalledMessage) {
        try {
            // 使用传入的 sendTime 定位分表
            LocalDateTime sendTime = recalledMessage.getSendTime();
            if (sendTime == null) {
                return false;
            }
            DynamicTableContext.setTime(sendTime);

            // 直接用ID更新撤回状态
            LambdaUpdateWrapper<Message> updateWrapper = new LambdaUpdateWrapper<>();
            updateWrapper.eq(Message::getId, recalledMessage.getId())
                    .set(Message::getIsRecalled, true);

            return this.update(updateWrapper);
        } finally {
            DynamicTableContext.clear();
        }
    }

    @Override
    public Set<String> getWhoChat(String openid) {
        Set<String> chatPartners = new HashSet<>();

        // 获取所有需要查询的分表时间点
        List<LocalDateTime> allTimePoints = getAllTableTimePoints();

        for (LocalDateTime timePoint : allTimePoints) {
            try {
                DynamicTableContext.setTime(timePoint);

                // 查询当前表中与该用户相关的所有消息
                LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<>();
                wrapper.and(w -> w.eq(Message::getSenderOpenid, openid)
                        .or()
                        .eq(Message::getReceiverOpenid, openid));

                List<Message> messages = this.list(wrapper);

                for (Message msg : messages) {
                    if (openid.equals(msg.getSenderOpenid())) {
                        chatPartners.add(msg.getReceiverOpenid());
                    } else {
                        chatPartners.add(msg.getSenderOpenid());
                    }
                }
            } finally {
                DynamicTableContext.clear();
            }
        }

        return chatPartners;
    }

    @Override
    public Map<String, Message> getLastMessageByEachSender(String openid, List<String> openidList) {
        if (openidList == null || openidList.isEmpty()) {
            return new HashMap<>();
        }

        Map<String, Message> resultMap = new HashMap<>();
        Set<String> foundUsers = new HashSet<>();

        List<LocalDateTime> allTimePoints = getAllTableTimePoints();

        for (int i = allTimePoints.size() - 1; i >= 0; i--) {
            LocalDateTime timePoint = allTimePoints.get(i);

            try {
                DynamicTableContext.setTime(timePoint);

                LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<>();

                // 修正：正确使用括号确保OR条件整体生效
                wrapper.and(w -> w
                        .and(sub -> sub
                                .eq(Message::getSenderOpenid, openid)
                                .in(Message::getReceiverOpenid, openidList)
                        )
                        .or(sub -> sub
                                .eq(Message::getReceiverOpenid, openid)
                                .in(Message::getSenderOpenid, openidList)
                        )
                );

                // 排除已经找到的用户
                if (!foundUsers.isEmpty()) {
                    wrapper.and(w -> w
                            .notIn(Message::getSenderOpenid, foundUsers)
                            .notIn(Message::getReceiverOpenid, foundUsers)
                    );
                }

                wrapper.orderByDesc(Message::getSendTime);

                List<Message> messages = this.list(wrapper);

                for (Message msg : messages) {
                    String targetOpenid = getConversationPartner(openid, msg);
                    if (targetOpenid != null && !foundUsers.contains(targetOpenid)) {
                        resultMap.put(targetOpenid, msg);
                        foundUsers.add(targetOpenid);
                    }
                }

                if (foundUsers.size() >= openidList.size()) {
                    break;
                }

            } finally {
                DynamicTableContext.clear();
            }
        }

        for (String targetOpenid : openidList) {
            resultMap.putIfAbsent(targetOpenid, null);
        }

        return resultMap;
    }

    @Override
    public Map<String, List<Message>> getOfflineMessage(String openid) {
        Map<String, List<Message>> resultMap = new HashMap<>();
        List<Message> messages = null;

        try {
            // 使用当前时间定位分表
            DynamicTableContext.setTime(LocalDateTime.now());

            LambdaQueryWrapper<Message> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(Message::getReceiverOpenid, openid)
                    .eq(Message::getIsRead, false)
                    .eq(Message::getIsRecalled, false)
                    .eq(Message::getIsOffline, true)
                    .orderByAsc(Message::getSendTime);

            messages = this.list(wrapper);

            // 按发送者openid分组
            for (Message msg : messages) {
                String senderOpenid = msg.getSenderOpenid();
                resultMap.computeIfAbsent(senderOpenid, k -> new ArrayList<>())
                        .add(msg);
            }

        } finally {
            DynamicTableContext.clear();
        }

        // 批量更新消息的离线状态为false
        if (messages != null && !messages.isEmpty()) {
            try {
                DynamicTableContext.setTime(LocalDateTime.now());

                // 提取消息ID列表
                List<Long> messageIds = messages.stream()
                        .map(Message::getId)
                        .collect(Collectors.toList());

                // 批量更新
                LambdaUpdateWrapper<Message> updateWrapper = new LambdaUpdateWrapper<>();
                updateWrapper.in(Message::getId, messageIds)
                        .set(Message::getIsOffline, false);

                this.update(updateWrapper);

            } finally {
                DynamicTableContext.clear();
            }
        }

        return resultMap;
    }

    /**
     * 获取与当前用户聊天的对方openid
     * @param currentUser 当前用户openid
     * @param message 消息对象
     * @return 对方的openid，如果消息不涉及当前用户则返回null
     */
    private String getConversationPartner(String currentUser, Message message) {
        String sender = message.getSenderOpenid();
        String receiver = message.getReceiverOpenid();

        if (currentUser.equals(sender)) {
            return receiver;
        } else if (currentUser.equals(receiver)) {
            return sender;
        }
        return null;
    }

    /**
     * 获取所有需要查询的分表时间点
     * 分表规则：每6个月一张表，格式为 message_YYYYMM
     * 例如：message_202601 (2026年1月-2026年6月)
     *      message_202607 (2026年7月-2026年12月)
     */
    private List<LocalDateTime> getAllTableTimePoints() {
        List<LocalDateTime> timePoints = new ArrayList<>();

        // 假设您的系统从 2026年1月 开始有数据
        LocalDateTime startDate = LocalDateTime.of(2026, 1, 1, 0, 0);
        LocalDateTime currentDate = LocalDateTime.now();

        // 每6个月生成一个时间点（取每个周期的起始月份）
        LocalDateTime cursor = startDate;
        while (!cursor.isAfter(currentDate)) {
            timePoints.add(cursor);
            cursor = cursor.plusMonths(6);
        }

        return timePoints;
    }
}
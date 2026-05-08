package com.example.circlemessage.websocket;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.example.circlemessage.entity.Message;
import com.example.circlemessage.entity.activity.Activity;
import com.example.circlemessage.entity.activity.ParticipantList;
import com.example.circlemessage.entity.group.GroupInfo;
import com.example.circlemessage.entity.group.GroupMember;
import com.example.circlemessage.entity.group.GroupMessage;
import com.example.circlemessage.service.MessageService;
import com.example.circlemessage.service.activity.ActivityService;
import com.example.circlemessage.service.activity.ParticipantListService;
import com.example.circlemessage.service.group.GroupInfoService;
import com.example.circlemessage.service.group.GroupMemberService;
import com.example.circlemessage.service.group.GroupMessageService;
import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

@Component
@SuppressWarnings("unused")
@ServerEndpoint("/ws/{userId}")
public class WebSocketServer {

    private static final ConcurrentHashMap<String, Session> SESSION_MAP = new ConcurrentHashMap<>();

    private static final ConcurrentHashMap<String, ScheduledFuture<?>> GROUP_CREATION_TASKS = new ConcurrentHashMap<>();
    private static final int WAIT_SECONDS = 30; // 等待30秒

    // 添加定时任务线程池
    private static final ScheduledExecutorService SCHEDULER = Executors.newScheduledThreadPool(10);

    // 使用线程池异步处理消息发送，避免阻塞和状态冲突
    private static final ExecutorService EXECUTOR_SERVICE = Executors.newCachedThreadPool();

    // 活动级别的锁，防止并发报名导致超员或重复建群
    private static final ConcurrentHashMap<String, ReentrantLock> ACTIVITY_LOCKS = new ConcurrentHashMap<>();

    private static MessageService messageService;
    private static ActivityService activityService;
    private static ParticipantListService participantListService;
    private static GroupInfoService groupInfoService;
    private static GroupMemberService groupMemberService;
    private static GroupMessageService groupMessageService;

    @Autowired
    public void setMessageService(MessageService messageService,
                                  ActivityService activityService,
                                  ParticipantListService participantListService,
                                  GroupInfoService groupInfoService,
                                  GroupMemberService groupMemberService,
                                  GroupMessageService groupMessageService) {
        WebSocketServer.messageService = messageService;
        WebSocketServer.activityService = activityService;
        WebSocketServer.participantListService = participantListService;
        WebSocketServer.groupInfoService = groupInfoService;
        WebSocketServer.groupMemberService = groupMemberService;
        WebSocketServer.groupMessageService = groupMessageService;
    }


    @OnOpen
    public void onOpen(Session session, @PathParam("userId") String userId) {
        SESSION_MAP.put(userId, session);
        System.out.println("用户 " + userId + " 已连接，当前在线人数：" + SESSION_MAP.size());

        // 使用异步方式发送欢迎消息，避免在连接未完全建立时发送
        sendMessageAsync(userId, "欢迎连接 WebSocket！");
    }

    @OnMessage
    public void onMessage(String message, Session session, @PathParam("userId") String fromUserId) {
        System.out.println("收到用户 " + fromUserId + " 的消息：" + message);

        if ("ping".equals(message)) {
            sendMessageAsync(fromUserId, "pong");
            return;
        }

        try {
            JSONObject json = JSON.parseObject(message);
            String type = json.getString("type");

            switch (type) {
                case "recall" -> handleRecallMessage(json, fromUserId);
                case "new_group_message" -> handleNewGroupMessage(json, fromUserId);
                case "recall_group_message" -> handleRecallGroupMessage(json, fromUserId);
                case "publish_activity" -> handlePublishActivity(json, fromUserId);
                case "cancel_activity" -> handleCancelActivity(json, fromUserId);
                case "join_activity" -> handleJoinActivity(json, fromUserId);
                case "exit_activity" -> handleExitActivity(json, fromUserId);
                default -> handleNormalMessage(json, fromUserId);
            }

        } catch (Exception e) {
            System.err.println("消息处理失败：" + e.getMessage());
            e.printStackTrace();
            sendMessageAsync(fromUserId, "消息格式错误");
        }
    }

    @OnClose
    public void onClose(@PathParam("userId") String userId) {
        SESSION_MAP.remove(userId);
        System.out.println("用户 " + userId + " 已断开，当前在线人数：" + SESSION_MAP.size());
    }

    @OnError
    public void onError(Session session, Throwable error, @PathParam("userId") String userId) {
        System.err.println("用户 " + userId + " 发生错误：" + error.getMessage());
        error.printStackTrace();
    }


    /**
     * 处理普通信息，用户之间私聊
     */
    private void handleNormalMessage(JSONObject json, String fromUserId) {
        try {
            String toUserId = json.getString("to");
            String content = json.getString("content");
            Integer messageType = json.getInteger("messageType");
            Long tempId = json.getLong("tempId");

            if (messageType == null) messageType = 1;

            // 判断对方是否在线（检查是否在SESSION_MAP中且连接有效）
            boolean isReceiverOnline = SESSION_MAP.containsKey(toUserId)
                    && SESSION_MAP.get(toUserId) != null
                    && SESSION_MAP.get(toUserId).isOpen();

            Message oneMessage = new Message();
            oneMessage.setSenderOpenid(fromUserId);
            oneMessage.setReceiverOpenid(toUserId);
            oneMessage.setContent(content);
            oneMessage.setMessageType(messageType);
            oneMessage.setSendTime(LocalDateTime.now());
            oneMessage.setIsRead(false);
            oneMessage.setIsRecalled(false);
            oneMessage.setIsOffline(!isReceiverOnline);  // 不在线 = 离线消息
            oneMessage.setSessionId(generateSessionId(fromUserId, toUserId));

            Message savedMessage = null;
            if (messageService != null) {
                messageService.sendMessage(oneMessage);
                savedMessage = oneMessage;
                System.out.println("消息已保存，ID: " + oneMessage.getId());
            }

            // 2. 转发消息给接收者
            JSONObject forwardMsg = new JSONObject();
            forwardMsg.put("type", "new_message");
            forwardMsg.put("from", fromUserId);
            forwardMsg.put("to", toUserId);
            forwardMsg.put("content", content);
            forwardMsg.put("time", savedMessage != null ? savedMessage.getSendTime().toString() : LocalDateTime.now().toString());
            forwardMsg.put("id", savedMessage != null ? savedMessage.getId() : null);
            forwardMsg.put("messageType", messageType);

            boolean success = sendMessageAsync(toUserId, forwardMsg.toString());
            sendMessageAsync(fromUserId, forwardMsg.toString());

            if (!success) {
                System.out.println("用户 " + toUserId + " 不在线，消息已保存");
            }

        } catch (Exception e) {
            System.err.println("普通消息处理失败：" + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 处理撤回信息，用户之间撤回
     */
    private void handleRecallMessage(JSONObject json, String fromUserId) {
        try {
            Long messageId = json.getLong("messageId");
            String toUserId = json.getString("to");
            String sendTime = json.getString("sendTime");

            System.out.println("收到撤回请求，用户: " + fromUserId + ", 消息ID: " + messageId);

            if (messageService != null) {
                Message recalledMessage = new Message();
                recalledMessage.setId(messageId);
                recalledMessage.setSenderOpenid(fromUserId);
                recalledMessage.setSendTime(LocalDateTime.parse(sendTime));

                Boolean result = messageService.recalledMessage(recalledMessage);

                if (result) {
                    // 关键：将 messageId 转为字符串
                    String messageIdStr = String.valueOf(messageId);

                    // 通知发送者
                    JSONObject senderRecallMsg = new JSONObject();
                    senderRecallMsg.put("type", "message_recalled");
                    senderRecallMsg.put("messageId", messageIdStr);
                    senderRecallMsg.put("isSelf", true);
                    sendMessageAsync(fromUserId, senderRecallMsg.toString());

                    // 通知接收者
                    if (toUserId != null) {
                        JSONObject receiverRecallMsg = new JSONObject();
                        receiverRecallMsg.put("type", "message_recalled");
                        receiverRecallMsg.put("messageId", messageIdStr);
                        receiverRecallMsg.put("isSelf", false);
                        sendMessageAsync(toUserId, receiverRecallMsg.toString());
                    }

                    System.out.println("撤回成功，已通知双方");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 处理活动发布，向所有用户广播活动信息
     */
    private void handlePublishActivity(JSONObject json, String fromUserId) {
        try {
            JSONObject activity = json.getJSONObject("activity");

            // 先判空，再使用
            if (activity == null) {
                System.err.println("活动信息为空");
                return;
            }

            JSONObject userInfo = activity.getJSONObject("userInfo");

            Activity newActivity = new Activity();

            newActivity.setInitiator(userInfo.getString("openId"));
            newActivity.setActivityUuid(activity.getString("uuid"));
            newActivity.setTime(LocalDateTime.now());
            newActivity.setValue(Integer.valueOf(activity.getString("value")));

            String participant = activityService.saveActivity(newActivity);

            JSONArray openidList = activity.getJSONArray("openidList");

            // 打印openid列表（调试用）
            if (openidList != null) {
                System.out.println("准备向以下用户发送活动通知：");
                for (Object openid : openidList) {
                    System.out.println("  - " + openid);
                }
            } else {
                System.out.println("警告：openidList为空");
            }

            activity.put("value", Integer.valueOf(activity.getString("value")));
            activity.put("publisherId", fromUserId);
            activity.put("publishTime", LocalDateTime.now().toString());

            activity.remove("openidList");

            JSONObject forwardMsg = new JSONObject();
            forwardMsg.put("type", "new_activity");
            forwardMsg.put("participant", participant);
            forwardMsg.put("from", fromUserId);
            forwardMsg.put("activity", activity);

            String messageStr = forwardMsg.toString();

            // 广播给指定用户
            broadcastToAll(messageStr, openidList);

        } catch (Exception e) {
            System.err.println("活动发布处理失败：" + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 处理取消活动，通知所有参与用户活动已取消
     */
    private void handleCancelActivity(JSONObject json, String fromUserId) {
        try {
            JSONArray openidList = json.getJSONArray("openidList");
            String participantListUuid = json.getString("participantListUuid");

            ScheduledFuture<?> future = GROUP_CREATION_TASKS.remove(participantListUuid);
            activityService.cancelActivity(participantListUuid);

            System.out.println("收到取消活动请求，用户: " + fromUserId + ", 活动UUID: " + participantListUuid);

            // 构建取消通知消息
            JSONObject cancelMsg = new JSONObject();
            cancelMsg.put("type", "activity_cancelled");
            cancelMsg.put("participantListUuid", participantListUuid);
            cancelMsg.put("from", fromUserId);
            cancelMsg.put("cancelTime", LocalDateTime.now().toString());

            String messageStr = cancelMsg.toString();

            broadcastToAll(messageStr, openidList);

        } catch (Exception e) {
            System.err.println("取消活动处理失败：" + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 处理参加活动（带锁版本）
     */
    private void handleJoinActivity(JSONObject json, String fromUserId) {
        String participantListUuid = json.getString("participantListUuid");
        JSONArray openidList = json.getJSONArray("openidList");

        // 获取或创建该活动的锁
        ReentrantLock lock = ACTIVITY_LOCKS.computeIfAbsent(participantListUuid, k -> new ReentrantLock());

        lock.lock();
        try {
            // 获取活动最大人数
            Integer maxCount = activityService.ActivityMaxCount(participantListUuid);

            // 1. 先检查是否已满员（防止锁内超员）
            int currentCount = participantListService.getJoinCount(participantListUuid);
            if (currentCount >= maxCount) {
                JSONObject errorMsg = new JSONObject();
                errorMsg.put("type", "join_failed");
                errorMsg.put("message", "活动已满员，无法加入");
                sendMessageAsync(fromUserId, errorMsg.toString());
                return;
            }

            // 2. 报名
            ParticipantList participantList = new ParticipantList();
            participantList.setParticipantListUuid(participantListUuid);
            participantList.setOpenid(fromUserId);
            participantList.setTime(LocalDateTime.now());

            String joinOpenid = participantListService.joinActivity(participantList);

            // 3. 重新获取最新人数
            currentCount = participantListService.getJoinCount(participantListUuid);

            System.out.println("用户 " + fromUserId + " 加入活动 " + participantListUuid + ", 当前人数: " + currentCount + "/" + maxCount);

            // 4. 广播加入消息
            JSONObject joinMsg = new JSONObject();
            joinMsg.put("type", "activity_joined");
            joinMsg.put("joinOpenid", joinOpenid);
            joinMsg.put("participantListUuid", participantListUuid);
            joinMsg.put("from", fromUserId);
            joinMsg.put("joinedTime", LocalDateTime.now().toString());
            joinMsg.put("currentCount", currentCount);
            joinMsg.put("maxCount", maxCount);

            broadcastToAll(joinMsg.toString(), openidList);

            // 5. 检查是否人满，启动倒计时（双重检查，在锁内保证原子性）
            if (currentCount >= maxCount - 1 && !GROUP_CREATION_TASKS.containsKey(participantListUuid)) {
                startGroupCreationCountdown(participantListUuid, openidList, fromUserId, participantListUuid);
            }

        } catch (Exception e) {
            System.err.println("参加活动处理失败：" + e.getMessage());
            e.printStackTrace();
            // 通知用户报名失败
            JSONObject errorMsg = new JSONObject();
            errorMsg.put("type", "join_failed");
            errorMsg.put("message", "报名失败：" + e.getMessage());
            sendMessageAsync(fromUserId, errorMsg.toString());
        } finally {
            lock.unlock();
            // 如果锁队列为空，移除以释放内存
            if (!lock.hasQueuedThreads()) {
                ACTIVITY_LOCKS.remove(participantListUuid, lock);
            }
        }
    }

    /**
     * 处理退出活动（带锁版本）
     */
    private void handleExitActivity(JSONObject json, String fromUserId) {
        String participantListUuid = json.getString("participantListUuid");
        JSONArray openidList = json.getJSONArray("openidList");

        ReentrantLock lock = ACTIVITY_LOCKS.get(participantListUuid);
        if (lock == null) {
            // 没有锁说明没有并发操作，直接执行
            exitActivityInternal(json, fromUserId, participantListUuid, openidList);
            return;
        }

        lock.lock();
        try {
            exitActivityInternal(json, fromUserId, participantListUuid, openidList);
        } finally {
            lock.unlock();
        }
    }

    /**
     * 退出活动的实际逻辑
     */
    private void exitActivityInternal(JSONObject json, String fromUserId, String participantListUuid, JSONArray openidList) {
        try {
            ParticipantList participantList = new ParticipantList();
            participantList.setParticipantListUuid(participantListUuid);
            participantList.setOpenid(fromUserId);
            participantList.setTime(LocalDateTime.now());

            participantListService.exitActivity(participantList);

            System.out.println("用户 " + fromUserId + " 退出活动 " + participantListUuid);

            // 取消倒计时（如果有）
            ScheduledFuture<?> future = GROUP_CREATION_TASKS.remove(participantListUuid);
            if (future != null && !future.isDone()) {
                future.cancel(false);
                System.out.println("已取消活动 " + participantListUuid + " 的群组创建倒计时");
            }

            // 广播退出消息
            JSONObject exitMsg = new JSONObject();
            exitMsg.put("type", "activity_exit");
            exitMsg.put("participantListUuid", participantListUuid);
            exitMsg.put("from", fromUserId);
            exitMsg.put("exitTime", LocalDateTime.now().toString());

            broadcastToAll(exitMsg.toString(), openidList);

        } catch (Exception e) {
            System.err.println("退出活动处理失败：" + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleNewGroupMessage(JSONObject json, String fromUserId) {
        String content = json.getString("content");
        String groupUuid = json.getString("groupUuid");
        System.out.println("content: " + content);
        System.out.println("groupUuid: " + groupUuid);
        System.out.println("用户发送群聊信息: " + fromUserId);

        GroupMessage message = new GroupMessage();
        message.setSenderOpenid(fromUserId);
        message.setGroupUuid(groupUuid);
        message.setContent(content);
        message.setSendTime(LocalDateTime.now());

        String id = String.valueOf(groupMessageService.sendGroupMessage(message));

        // 构建群聊消息
        JSONObject groupMsg = new JSONObject();
        groupMsg.put("type", "new_message_group");
        groupMsg.put("groupUuid", groupUuid);
        groupMsg.put("id", id);
        groupMsg.put("content", content);
        groupMsg.put("from", fromUserId);
        groupMsg.put("sendTime", LocalDateTime.now().toString());

        String messageStr = groupMsg.toString();

        broadcastToAll(messageStr, groupMemberService.getGroupOpenid(groupUuid));
    }

    private void handleRecallGroupMessage(JSONObject json, String fromUserId) {
        String groupUuid = json.getString("groupUuid");
        String id = json.getString("messageId");
        String senderNickname = json.getString("senderNickname");
        System.out.println("groupUuid: " + groupUuid);
        System.out.println(senderNickname + " 用户撤回群聊信息: " + fromUserId);

        groupMessageService.recallGroupMessage(id);

        // 构建撤回消息
        JSONObject recallMsg = new JSONObject();
        recallMsg.put("type", "recall_message_group");
        recallMsg.put("groupUuid", groupUuid);
        recallMsg.put("senderNickname", senderNickname);
        recallMsg.put("id", id);
        recallMsg.put("from", fromUserId);
        recallMsg.put("sendTime", LocalDateTime.now().toString());

        String messageStr = recallMsg.toString();

        broadcastToAll(messageStr, groupMemberService.getGroupOpenid(groupUuid));
    }


    /**
     * 启动群组创建倒计时
     */
    private void startGroupCreationCountdown(String participantListUuid,
                                             JSONArray openidList,
                                             String fromId,
                                             String participant) {
        System.out.println("活动 " + participantListUuid + " 人满，启动 " + WAIT_SECONDS + " 秒倒计时创建群组");

        // 通知所有参与者倒计时开始
        JSONObject countdownMsg = new JSONObject();
        countdownMsg.put("type", "group_countdown_start");
        countdownMsg.put("participantListUuid", participantListUuid);
        countdownMsg.put("seconds", WAIT_SECONDS);
        countdownMsg.put("message", "活动人数已满，将在 " + WAIT_SECONDS + " 秒后自动创建群聊");
        broadcastToAll(countdownMsg.toString(), openidList);

        // 启动定时任务
        ScheduledFuture<?> future = SCHEDULER.schedule(() -> {
            try {
                // 再次检查当前人数（防止倒计时期间有人退出）
                int currentCount = participantListService.getJoinCount(participantListUuid);
                int maxCount = activityService.ActivityMaxCount(participantListUuid);

                if (currentCount >= maxCount - 1) {
                    if (createGroupForActivity(participantListUuid, fromId, participant)) {
                        System.out.println("群组创建成功");
                    }
                } else {
                    System.out.println("活动 " + participantListUuid + " 人数不足，取消创建群组");
                }
            } catch (Exception e) {
                System.err.println("创建群组失败: " + e.getMessage());
            } finally {
                GROUP_CREATION_TASKS.remove(participantListUuid);
            }
        }, WAIT_SECONDS, TimeUnit.SECONDS);

        GROUP_CREATION_TASKS.put(participantListUuid, future);
    }

    private Boolean createGroupForActivity(String participantListUuid, String fromId, String participant) {
        String initiator = activityService.getInitiator(participantListUuid);
        List<String> memberOpenidList = participantListService.joinOpenid(participantListUuid);

        GroupInfo groupInfo = new GroupInfo();
        groupInfo.setGroupName("群聊");

        List<GroupMember> memberList = new ArrayList<>();

        // 添加所有参与成员
        for (String openid : memberOpenidList) {
            GroupMember member = new GroupMember();
            member.setOpenid(openid);
            memberList.add(member);
        }

        // 添加发起人（注意：如果 initiator 已经在 memberOpenidList 中，避免重复添加）
        GroupMember initiatorMember = new GroupMember();
        initiatorMember.setOpenid(initiator);
        if (!memberOpenidList.contains(initiator)) {
            memberList.add(initiatorMember);
        }

        groupInfo.setGroupMembers(memberList);

        groupInfo = groupInfoService.saveGroup(groupInfo, fromId);

        // 获取群组成员的 openid 列表用于广播
        List<String> allMemberOpenids = new ArrayList<>(memberOpenidList);
        if (!memberOpenidList.contains(initiator)) {
            allMemberOpenids.add(initiator);
        }

        JSONObject joinMsg = new JSONObject();
        joinMsg.put("type", "create_group_success");
        joinMsg.put("groupInfo", JSON.toJSON(groupInfo));
        joinMsg.put("sendTime", LocalDateTime.now().toString());
        joinMsg.put("participantListUuid", participantListUuid);

        String messageStr = joinMsg.toString();

        activityService.finishActivity(participant);
        // 广播给所有群成员
        broadcastToAll(messageStr, allMemberOpenids);

        return true;
    }

    // 异步发送消息
    public static boolean sendMessageAsync(String userId, String message) {
        Session session = SESSION_MAP.get(userId);
        if (session != null && session.isOpen()) {
            // 使用线程池异步发送
            EXECUTOR_SERVICE.submit(() -> {
                synchronized (session) {
                    try {
                        // 检查 session 是否仍然有效
                        if (session.isOpen()) {
                            session.getBasicRemote().sendText(message);
                        }
                    } catch (IOException e) {
                        System.err.println("发送消息失败给用户 " + userId + ": " + e.getMessage());
                        e.printStackTrace();
                    }
                }
            });
            return true;
        }
        return false;
    }

    /**
     * 广播消息给指定的用户列表（JSONArray版本）
     */
    private void broadcastToAll(String message, JSONArray openidList) {
        if (openidList == null || openidList.isEmpty()) {
            System.out.println("openidList为空，无法广播消息");
            return;
        }

        int successCount = 0;
        int totalCount = openidList.size();

        for (int i = 0; i < totalCount; i++) {
            String userId = openidList.getString(i);
            if (sendMessageAsync(userId, message)) {
                successCount++;
            } else {
                System.out.println("用户 " + userId + " 不在线或发送失败");
            }
        }

        System.out.println("广播完成，成功发送给 " + successCount + "/" + totalCount + " 个用户");
    }

    /**
     * 广播消息给指定的用户列表（List版本）
     */
    private void broadcastToAll(String messageStr, List<String> openidList) {
        if (openidList == null || openidList.isEmpty()) {
            System.out.println("openidList为空，无法广播消息");
            return;
        }

        int successCount = 0;
        int totalCount = openidList.size();

        for (String openid : openidList) {
            if (sendMessageAsync(openid, messageStr)) {
                successCount++;
            } else {
                System.out.println("用户 " + openid + " 不在线或发送失败");
            }
        }

        System.out.println("广播完成，成功发送给 " + successCount + "/" + totalCount + " 个用户");
    }


    private String generateSessionId(String user1, String user2) {
        return user1.compareTo(user2) < 0 ? user1 + ":" + user2 : user2 + ":" + user1;
    }
}
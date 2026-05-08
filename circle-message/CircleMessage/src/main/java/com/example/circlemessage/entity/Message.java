package com.example.circlemessage.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("messages")
public class Message {

    @JsonSerialize(using = ToStringSerializer.class)
    @TableId(type = IdType.ASSIGN_ID) // 使用雪花算法自动生成ID
    private Long id;                    // 消息ID（雪花算法）

    private String sessionId;           // 会话ID
    private String senderOpenid;        // 发送者openid
    private String receiverOpenid;      // 接收者openid
    private Integer messageType;        // 1:文本 2:图片 3:文件 4:语音
    private String content;             // 消息内容
    private String fileUrl;             // 文件URL
    private LocalDateTime sendTime;     // 发送时间
    private Boolean isRead;             // 是否可读
    private Boolean isRecalled;         // 是否撤回
    private Boolean isOffline;
}
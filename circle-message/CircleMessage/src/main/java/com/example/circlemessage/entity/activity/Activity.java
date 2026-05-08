package com.example.circlemessage.entity.activity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class Activity {
    @TableId
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String initiator;
    private String activityUuid;
    private String participantListUuid;
    private Integer value;

    private LocalDateTime time;

    @TableField(exist = false)
    private List<ParticipantList> participantListList;
    private Boolean isCancel;
    private Boolean isGroup;
}

package com.example.circlemessage.entity.activity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ParticipantList {
    @TableId
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String participantListUuid;
    private String openid;

    private Boolean isExit;
    private LocalDateTime time;
}

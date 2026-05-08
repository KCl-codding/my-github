package com.example.circlebackend.entity.yard;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.util.List;

@Data
public class Yard {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("OPENID")
    private String openid;
    @TableField("TYPE")
    private String type;
    @TableField("UUID")
    private String uuid;
    @TableField("ACTIVITY")
    private String activity;
    @TableField("POSITION")
    private String position;
    @TableField("VALUE")
    private Integer value;

    @TableField(exist = false)
    private List<Pay> pays;
    @TableField(exist = false)
    private List<YardImage> urls;
}

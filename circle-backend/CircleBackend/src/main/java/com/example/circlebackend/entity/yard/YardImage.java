package com.example.circlebackend.entity.yard;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

@Data
public class YardImage {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("UUID")
    private String uuid;
    @TableField("URL")
    private String url;
}

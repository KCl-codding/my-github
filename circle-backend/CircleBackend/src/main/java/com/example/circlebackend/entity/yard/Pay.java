package com.example.circlebackend.entity.yard;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

@Data
public class Pay {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("UUID")
    private String uuid;
    @TableField("PAYS_UUID")
    private String paysUuid;
    @TableField("PAY_PROJECT")
    private String payProject;
    @TableField("MONEY")
    private Double money;
}

package com.example.circlebackend.service.yard;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.entity.yard.Pay;

import java.util.List;

public interface PayService extends IService<Pay> {
    Boolean savePay(Pay pay);
    List<Pay> getPayProject(String uuid);
    Boolean deletePay(String payUuid);
}

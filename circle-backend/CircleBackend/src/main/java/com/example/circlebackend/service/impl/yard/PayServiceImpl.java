package com.example.circlebackend.service.impl.yard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.entity.yard.Pay;
import com.example.circlebackend.mapper.yard.PayMapper;
import com.example.circlebackend.service.yard.PayService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class PayServiceImpl
        extends ServiceImpl<PayMapper, Pay>
        implements PayService {

    @Override
    public Boolean savePay(Pay pay) {
        pay.setPaysUuid(UUID.randomUUID().toString().replace("-", ""));
        return this.save(pay);
    }

    @Override
    public List<Pay> getPayProject(String uuid) {
        // 使用 LambdaQueryWrapper 构建查询条件
        LambdaQueryWrapper<Pay> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Pay::getUuid, uuid);

        return this.list(queryWrapper);
    }

    @Override
    public Boolean deletePay(String paysUuid) {
        // 方法1：根据 paysUuid 直接删除（推荐）
        if (paysUuid == null || paysUuid.trim().isEmpty()) {
            return false;
        }

        // 使用 LambdaQueryWrapper 构建删除条件
        LambdaQueryWrapper<Pay> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Pay::getPaysUuid, paysUuid);

        return this.remove(queryWrapper);
    }
}

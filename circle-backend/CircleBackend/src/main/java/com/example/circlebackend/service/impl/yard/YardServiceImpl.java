package com.example.circlebackend.service.impl.yard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.entity.yard.Pay;
import com.example.circlebackend.entity.yard.Yard;
import com.example.circlebackend.entity.yard.YardImage;
import com.example.circlebackend.mapper.yard.YardMapper;
import com.example.circlebackend.service.yard.PayService;
import com.example.circlebackend.service.yard.YardImageService;
import com.example.circlebackend.service.yard.YardService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
public class YardServiceImpl
        extends ServiceImpl<YardMapper, Yard>
        implements YardService {

    @Autowired
    private PayService payService;

    @Autowired
    private YardImageService yardImageService;

    @Override
    public Boolean saveYard(Yard yard) {
        yard.setUuid(UUID.randomUUID().toString().replace("-", ""));

        // 批量插入支付项
        if (yard.getPays() != null && !yard.getPays().isEmpty()) {
            for (Pay pay : yard.getPays()) {
                pay.setUuid(yard.getUuid());
            }
            payService.saveBatch(yard.getPays());  // ✅ 批量插入
        }

        // 批量插入图片
        if (yard.getUrls() != null && !yard.getUrls().isEmpty()) {
            for (YardImage yardImage : yard.getUrls()) {
                yardImage.setUuid(yard.getUuid());
            }
            yardImageService.saveBatch(yard.getUrls());  // ✅ 批量插入
        }

        return this.save(yard);
    }

    @Override
    public List<Yard> getOpenidYards(String openid) {
        LambdaQueryWrapper<Yard> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Yard::getOpenid, openid);

        List<Yard> yards = this.list(queryWrapper);
        for (Yard yard : yards) {
            yard.setPays(payService.getPayProject(yard.getUuid()));
            yard.setUrls(yardImageService.getYardImage(yard.getUuid()));
        }

        return yards;
    }

    @Override
    public Yard getUuidYard(String uuid) {
        LambdaQueryWrapper<Yard> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Yard::getUuid, uuid);

        Yard yard = this.getOne(queryWrapper);
        yard.setPays(payService.getPayProject(uuid));
        yard.setUrls(yardImageService.getYardImage(uuid));

        return yard;
    }

    @Override
    public List<Yard> getAllYards() {
        List<Yard> yards = this.list();
        for (Yard yard : yards) {
            yard.setPays(payService.getPayProject(yard.getUuid()));
            yard.setUrls(yardImageService.getYardImage(yard.getUuid()));
        }
        return yards;
    }

    @Override
    public List<Yard> getFourYards() {
        List<Yard> allYards = new ArrayList<>(this.list());
        if (allYards.isEmpty()) {
            return new ArrayList<>();
        }

        // 使用当天日期作为随机种子
        long seed = LocalDate.now().toEpochDay();
        Collections.shuffle(allYards, new Random(seed));

        // 取前4个（如果不足4个则取全部）
        List<Yard> result = allYards.subList(0, Math.min(4, allYards.size()));

        // 填充 pays 和 urls
        for (Yard yard : result) {
            yard.setPays(payService.getPayProject(yard.getUuid()));
            yard.setUrls(yardImageService.getYardImage(yard.getUuid()));
        }

        return new ArrayList<>(result);
    }
    @Override
    public List<Yard> getFourYardsByType(String type) {
        // 根据类型查询所有场地
        LambdaQueryWrapper<Yard> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Yard::getType, type);
        List<Yard> typeYards = this.list(queryWrapper);

        if (typeYards.isEmpty()) {
            return new ArrayList<>();
        }


        // 填充 pays 和 urls
        for (Yard yard : typeYards) {
            yard.setPays(payService.getPayProject(yard.getUuid()));
            yard.setUrls(yardImageService.getYardImage(yard.getUuid()));
        }

        return new ArrayList<>(typeYards);
    }
}

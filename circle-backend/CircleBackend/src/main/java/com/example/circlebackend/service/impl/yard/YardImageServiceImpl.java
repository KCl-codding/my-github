package com.example.circlebackend.service.impl.yard;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.entity.yard.Yard;
import com.example.circlebackend.entity.yard.YardImage;
import com.example.circlebackend.mapper.yard.YardImageMapper;
import com.example.circlebackend.service.yard.YardImageService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class YardImageServiceImpl
        extends ServiceImpl<YardImageMapper, YardImage>
        implements YardImageService {

    @Override
    public List<YardImage> getYardImage(String uuid) {
        LambdaQueryWrapper<YardImage> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(YardImage::getUuid, uuid);

        return this.list(queryWrapper);
    }
}

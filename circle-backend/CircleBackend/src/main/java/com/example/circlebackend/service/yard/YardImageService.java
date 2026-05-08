package com.example.circlebackend.service.yard;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.entity.yard.YardImage;

import java.util.List;

public interface YardImageService extends IService<YardImage> {
    List<YardImage> getYardImage(String uuid);
}

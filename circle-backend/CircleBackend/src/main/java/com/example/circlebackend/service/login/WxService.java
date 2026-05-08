package com.example.circlebackend.service.login;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.dto.LoginDto;
import com.example.circlebackend.entity.login.User;

import java.util.Map;

public interface WxService extends IService<User> {
    Map<String, Object> login(LoginDto loginDto);
}

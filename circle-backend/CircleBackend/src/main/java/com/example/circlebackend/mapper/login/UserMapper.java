package com.example.circlebackend.mapper.login;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.circlebackend.entity.login.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}

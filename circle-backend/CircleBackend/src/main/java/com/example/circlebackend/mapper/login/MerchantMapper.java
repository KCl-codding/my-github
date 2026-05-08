package com.example.circlebackend.mapper.login;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.circlebackend.entity.login.Merchant;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MerchantMapper extends BaseMapper<Merchant> {
}

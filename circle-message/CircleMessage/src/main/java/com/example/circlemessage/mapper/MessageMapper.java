package com.example.circlemessage.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.circlemessage.entity.Message;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MessageMapper extends BaseMapper<Message> {
}

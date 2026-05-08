package com.example.circlemessage.service.impl.group;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.entity.group.GroupMember;
import com.example.circlemessage.mapper.gruop.GroupMemberMapper;
import com.example.circlemessage.service.group.GroupMemberService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class GroupMemberServiceImpl
        extends ServiceImpl<GroupMemberMapper, GroupMember>
        implements GroupMemberService {
    @Override
    public Boolean saveGroupMember(GroupMember groupMember) {
        return this.save(groupMember);
    }

    @Override
    public List<String> getGroupUuid(String openid) {
        LambdaQueryWrapper<GroupMember> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(GroupMember::getOpenid, openid);
        List<GroupMember> list = this.list(queryWrapper);

        return list.stream()
                .map(GroupMember::getGroupUuid)
                .collect(Collectors.toList());
    }

    @Override
    public List<GroupMember> getGroupMemberByGroupUuid(String groupUuid) {
        LambdaQueryWrapper<GroupMember> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(GroupMember::getGroupUuid, groupUuid);
        return this.list(queryWrapper);
    }

    @Override
    public List<String> getGroupOpenid(String groupUuid) {
        LambdaQueryWrapper<GroupMember> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(GroupMember::getGroupUuid, groupUuid);
        // 只查询 openid 字段
        queryWrapper.select(GroupMember::getOpenid);
        // 转换为 String 列表
        return this.list(queryWrapper).stream()
                .map(GroupMember::getOpenid)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
}

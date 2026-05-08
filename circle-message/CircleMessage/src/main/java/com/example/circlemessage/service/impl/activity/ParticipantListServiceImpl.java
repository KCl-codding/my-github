package com.example.circlemessage.service.impl.activity;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.entity.activity.ParticipantList;
import com.example.circlemessage.mapper.activity.ParticipantListMapper;
import com.example.circlemessage.service.activity.ParticipantListService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ParticipantListServiceImpl
        extends ServiceImpl<ParticipantListMapper, ParticipantList>
        implements ParticipantListService {
    @Override
    public Integer getJoinCount(String participant) {
        Long count = lambdaQuery()
                .eq(ParticipantList::getParticipantListUuid, participant)
                .eq(ParticipantList::getIsExit, 0)
                .count();
        return count.intValue();
    }

    @Override
    public String joinActivity(ParticipantList participantList) {
        // 查询是否存在该用户在该活动中的记录
        LambdaQueryWrapper<ParticipantList> queryWrapper = new LambdaQueryWrapper<ParticipantList>()
                .eq(ParticipantList::getOpenid, participantList.getOpenid())
                .eq(ParticipantList::getParticipantListUuid, participantList.getParticipantListUuid());

        ParticipantList existingRecord = this.getOne(queryWrapper);

        if (existingRecord != null) {
            // 存在记录，将 isExit 修改为 0（重新加入）
            existingRecord.setIsExit(false);
            this.updateById(existingRecord);
        } else {
            // 不存在记录，新增
            this.save(participantList);
        }

        return participantList.getOpenid();
    }

    @Override
    public List<String> joinOpenid(String participant) {
        LambdaQueryWrapper<ParticipantList> queryWrapper = new LambdaQueryWrapper<ParticipantList>()
                .eq(ParticipantList::getParticipantListUuid, participant)
                .eq(ParticipantList::getIsExit, 0);

        return this.list(queryWrapper).stream()
                .map(ParticipantList::getOpenid)
                .collect(Collectors.toList());
    }

    @Override
    public String exitActivity(ParticipantList participantList) {
        // 构建更新条件
        LambdaUpdateWrapper<ParticipantList> updateWrapper = new LambdaUpdateWrapper<ParticipantList>()
                .eq(ParticipantList::getOpenid, participantList.getOpenid())
                .eq(ParticipantList::getParticipantListUuid, participantList.getParticipantListUuid())
                .set(ParticipantList::getIsExit, 1);

        // 执行更新
        boolean updated = this.update(updateWrapper);
        if (updated) {
            return participantList.getOpenid();
        }
        return null;
    }
}

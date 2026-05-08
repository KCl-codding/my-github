package com.example.circlemessage.service.impl.activity;

import com.aventrix.jnanoid.jnanoid.NanoIdUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlemessage.entity.activity.Activity;
import com.example.circlemessage.mapper.activity.ActivityMapper;
import com.example.circlemessage.service.activity.ActivityService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;

@Service
public class ActivityServiceImpl
        extends ServiceImpl<ActivityMapper, Activity>
        implements ActivityService {

    private static final char[] ALPHABET = (
            "0123456789" +
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                    "abcdefghijklmnopqrstuvwxyz")
            .toCharArray();

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    public String saveActivity(Activity activity) {
        String participantListUuid = NanoIdUtils.randomNanoId(
                SECURE_RANDOM,  // 复用实例
                ALPHABET,       // 字符集
                8               // 长度
        );
        activity.setParticipantListUuid(participantListUuid);

        boolean saved = this.save(activity);
        return saved ? participantListUuid : "";
    }

    @Override
    public List<Activity> queryActivity() {
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getIsCancel,false);
        queryWrapper.eq(Activity::getIsGroup,false);
        return this.list(queryWrapper);
    }

    @Override
    public List<Activity> queryAllActivity() {
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        return this.list(queryWrapper);
    }

    @Override
    public Boolean cancelActivity(String participantListUuid) {
        System.out.println(participantListUuid);
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getParticipantListUuid, participantListUuid);
        Activity activity = this.getOne(queryWrapper);

        activity.setIsCancel(true);
        return this.updateById(activity);
    }

    @Override
    public Integer ActivityMaxCount(String participant) {
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getParticipantListUuid, participant);
        return this.getOne(queryWrapper).getValue();
    }

    @Override
    public String getInitiator(String participant) {
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getParticipantListUuid, participant);
        Activity activity = this.getOne(queryWrapper);
        return activity.getInitiator();
    }

    @Override
    public Boolean finishActivity(String participant) {
        LambdaQueryWrapper<Activity> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(Activity::getParticipantListUuid, participant);
        Activity activity = this.getOne(queryWrapper);

        if (activity == null) {
            // 活动不存在
            return false;
        }

        activity.setIsGroup(true);
        return this.updateById(activity);
    }
}
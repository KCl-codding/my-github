package com.example.circlemessage.service.activity;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlemessage.entity.activity.Activity;

import java.util.List;

public interface ActivityService extends IService<Activity> {
    String saveActivity(Activity activity);

    List<Activity> queryActivity();

    List<Activity> queryAllActivity();

    Boolean cancelActivity(String participant);

    Integer ActivityMaxCount(String participant);

    String getInitiator(String participant);

    Boolean finishActivity(String participant);
}

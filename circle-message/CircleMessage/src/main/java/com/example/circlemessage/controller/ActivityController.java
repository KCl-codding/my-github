package com.example.circlemessage.controller;

import com.example.circlemessage.entity.activity.Activity;
import com.example.circlemessage.service.activity.ActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    @Autowired
    private ActivityService activityService;

    @GetMapping("/get_all_activity")
    public List<Activity> activityList() {
        return activityService.queryActivity();
    }
    @GetMapping("/get_activity_include_all")
    public List<Activity> activityListIncludeAll(){
        return activityService.queryAllActivity();
    }
    @PostMapping("/cancel_activity")
    public Boolean cancelActivity(@RequestParam("participant")String participant) {
        return activityService.cancelActivity(participant);
    }
}

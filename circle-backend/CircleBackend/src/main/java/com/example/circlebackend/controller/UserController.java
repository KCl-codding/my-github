package com.example.circlebackend.controller;

import com.example.circlebackend.dto.LoginDto;
import com.example.circlebackend.entity.login.User;
import com.example.circlebackend.service.login.ConsumerService;
import com.example.circlebackend.service.login.MerchantService;
import com.example.circlebackend.service.login.WxService;
import com.example.circlebackend.utils.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/user/")
public class UserController {

    @Autowired
    private WxService wxService;
    @Autowired
    private ConsumerService consumerService;
    @Autowired
    private MerchantService merchantService;

    @PostMapping("save")
    public Result<Map<String, Object>> save(@RequestBody LoginDto loginDto) {
        return Result.success(wxService.login(loginDto));
    }

    @PostMapping("get_random_consumer")
    public Result<List<User>> getRandomUser(@RequestParam("openid") String openid) {
        return Result.success(consumerService.getRandomConsumerList(openid));
    }

    @GetMapping("get_all_consumer")
    public Result<List<User>> getAllConsumer() {
        return Result.success(consumerService.getConsumerList());
    }
    @GetMapping("get_all_merchant")
    public Result<List<User>> getAllMerchant() {
        return Result.success(merchantService.getMerchantsList());
    }
    @PostMapping("get_one_consumer")
    public Result<User> getOneConsumer(@RequestParam("openid") String openid) {
        return Result.success(consumerService.isExist(openid));
    }
    @PostMapping("get_one_merchant")
    public Result<User> getOneMerchant(@RequestParam("openid") String openid) {
        return Result.success(merchantService.isExist(openid));
    }



    @PostMapping("get_list_consumer")
    public Result<List<User>> getListConsumer(@RequestBody List<String> openidList) {
        return Result.success(consumerService.getConsumerList(openidList));
    }

    @PostMapping("upload_consumer_url")
    public Result<String> uploadConsumer(@RequestBody Map<String, String> params) {
        String openid = params.get("openid");
        String url = params.get("url");
        return Result.success(consumerService.upload(openid, url));
    }

    @PostMapping("edit_consumer_nickname")
    public Result<Boolean> editConsumerNickName(@RequestParam("openid") String openid,
                                                @RequestParam("nickname") String nickname) {
        return Result.success(consumerService.editNickname(openid, nickname));
    }
    @PostMapping("edit_consumer_gender")
    public Result<Boolean> editConsumerGender(@RequestParam("openid") String openid,
                                              @RequestParam("gender") String gender) {
        return Result.success(consumerService.editGender(openid, gender));
    }
    @PostMapping("edit_consumer_region")
    public Result<Boolean> editConsumerRegion(@RequestParam("openid") String openid,
                                              @RequestParam("province") String province,
                                              @RequestParam("city") String city) {
        return Result.success(consumerService.editRegion(openid, province, city));
    }


    @PostMapping("upload_merchant_url")
    public Result<String> uploadMerchant(@RequestBody Map<String, String> params) {
        String openid = params.get("openid");
        String url = params.get("url");
        return Result.success(merchantService.upload(openid, url));
    }

    @PostMapping("edit_merchant_nickname")
    public Result<Boolean> editMerchantNickName(@RequestParam("openid") String openid,
                                                @RequestParam("nickname") String nickname) {
        return Result.success(merchantService.editNickname(openid, nickname));
    }
    @PostMapping("edit_merchant_gender")
    public Result<Boolean> editMerchantGender(@RequestParam("openid") String openid,
                                              @RequestParam("gender") String gender) {
        return Result.success(merchantService.editGender(openid, gender));
    }
    @PostMapping("edit_merchant_region")
    public Result<Boolean> editMerchantRegion(@RequestParam("openid") String openid,
                                              @RequestParam("province") String province,
                                              @RequestParam("city") String city) {
        return Result.success(merchantService.editRegion(openid, province, city));
    }


    @GetMapping("get_all_consumer_openid")
    public Result<List<String>> getAllConsumerOpenid(){
        return Result.success(consumerService.getAllConsumerOpenid());
    }

    @PostMapping("get_join_url")
    public Result<List<String>> getJoinUrl(@RequestBody List<String> openidList){
        return Result.success(consumerService.getUrl(openidList));
    }

    @PostMapping("get_consumer_url")
    public Result<String> getConsumerUrl(@RequestParam("openid")String openid){
        return Result.success(consumerService.getUrl(openid));
    }
}

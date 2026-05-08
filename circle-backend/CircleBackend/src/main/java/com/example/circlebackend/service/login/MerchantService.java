package com.example.circlebackend.service.login;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.entity.login.Merchant;
import com.example.circlebackend.entity.login.User;

import java.util.List;

public interface MerchantService extends IService<Merchant> {

    User saveMerchant(Merchant merchant);
    User isExist(String openId);

    List<User> getMerchantsList();
    List<User> getMerchantsList(List<String> openidList);

    String upload(String openid, String url);
    Boolean editNickname(String openid, String nickname);
    Boolean editGender(String openid, String gender);
    Boolean editRegion(String openid, String province, String city);
}

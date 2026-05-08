package com.example.circlebackend.service.login;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.circlebackend.entity.login.Consumer;
import com.example.circlebackend.entity.login.User;

import java.util.List;

public interface ConsumerService extends IService<Consumer> {
    /**
     * 用户登录调用，存在->返回，不存在->保存
     * @param consumer 用户信息对象
     * @return 保存的用户信息
     */
    User saveConsumer(Consumer consumer);
    /**
     * 查看用户是否存在
     * @param openId 用户openid
     * @return 用户存在状态
     */
    User isExist(String openId);

    /**
     * 获取除了自己的五个用户
     * @param openId 自己的openid
     * @return 用户列表
     */
    List<User> getRandomConsumerList(String openId);
    /**
     * 获取所有用户数据
     * @return 用户列表
     */
    List<User> getConsumerList();
    /**
     * 通过openid列表获取用户数据，用于聊天列表
     * @param openidList 与自己openid聊过天的openid列表
     * @return 用户列表
     */
    List<User> getConsumerList(List<String> openidList);
    /**
     * 获取所有用户的openid，用于全体广播
     * @return 所有openid列表
     */
    List<String> getAllConsumerOpenid();
    /**
     * 获取openid列表对应的头像地址列表
     * @param openidList 用户列表
     * @return 头像列表
     */
    List<String> getUrl(List<String> openidList);
    /**
     * 单个openid换取头像地址
     * @param openid 用户openid
     * @return 单个头像地址
     */
    String getUrl(String openid);

    /**
     * 更换头像
     * @param openid 用户openid
     * @param url 新头像地址
     * @return 新头像地址
     */
    String upload(String openid, String url);
    /**
     * 修改昵称
     * @param openid 用户openid
     * @param nickname 修改后的昵称
     * @return 修改状态
     */
    Boolean editNickname(String openid, String nickname);
    /**
     * 更改性别
     * @param openid 用户openid
     * @param gender 修改后的性别
     * @return 修改状态
     */
    Boolean editGender(String openid, String gender);
    /**
     * 修改地区
     * @param openid 用户openid
     * @param province 省份
     * @param city 城市
     * @return 修改状态
     */
    Boolean editRegion(String openid, String province, String city);
}

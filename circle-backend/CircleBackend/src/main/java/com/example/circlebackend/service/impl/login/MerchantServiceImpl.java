package com.example.circlebackend.service.impl.login;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.entity.login.Merchant;
import com.example.circlebackend.entity.login.User;
import com.example.circlebackend.exception.ParamException;
import com.example.circlebackend.exception.ResultCode;
import com.example.circlebackend.exception.UserException;
import com.example.circlebackend.mapper.login.MerchantMapper;
import com.example.circlebackend.service.CosStsService;
import com.example.circlebackend.service.login.MerchantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class MerchantServiceImpl
        extends ServiceImpl<MerchantMapper, Merchant>
        implements MerchantService {

    /*————————————————————————————————————— 字段注入 —————————————————————————————————————*/
    @Autowired
    private CosStsService cosStsService;

    /*————————————————————————————————————— 保存商家 —————————————————————————————————————*/
    @Override
    public User saveMerchant(Merchant merchant) {
        if (merchant == null) {
            throw new ParamException(ResultCode.BAD_REQUEST);
        }
        this.save(merchant);
        return merchant;
    }
    @Override
    public User isExist(String openid) {
        // 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openId为空");
            throw new ParamException(ResultCode.BAD_REQUEST);
        }

        try {
            return lambdaQuery()
                    .eq(User::getOpenid, openid)
                    .one();
        } catch (Exception e) {
            log.error("查询用户失败, openId: {}", openid, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }
    /*———————————————————————————————————— 获取商家信息 ————————————————————————————————————*/
    @Override
    public List<User> getMerchantsList() {
        try {
            // 查询所有商户
            List<Merchant> merchants = this.list();

            if (merchants == null || merchants.isEmpty()) {
                log.info("没有找到任何商户");
                return List.of();
            }
            return new ArrayList<>(merchants);
        } catch (Exception e) {
            log.error("查询商户列表失败", e);
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }
    @Override
    public List<User> getMerchantsList(List<String> openidList) {
        if (openidList == null || openidList.isEmpty()) {
            log.warn("openIdList为空，返回空列表");
            throw new ParamException(ResultCode.BAD_REQUEST);
        }

        try {
            List<Merchant> merchants = this.lambdaQuery()
                    .in(Merchant::getOpenid, openidList)
                    .list();

            if (merchants == null || merchants.isEmpty()) {
                log.info("未查询到任何商户，openIdList: {}", openidList);  // 修正：商户
                return List.of();
            }

            // 直接返回Merchant列表
            log.info("成功查询到 {} 个商户", merchants.size());  // 修正：商户
            return new ArrayList<>(merchants);

        } catch (Exception e) {
            log.error("根据openIdList查询商户列表失败, openIdList: {}", openidList, e);  // 修正：商户
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }

    /*———————————————————————————————————— 修改用户信息 ————————————————————————————————————*/
    @Override
    public String upload(String openid, String url) {
        // 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法更新url");
            throw new ParamException(ResultCode.BAD_REQUEST, "未登录");
        }

        if (url == null || url.trim().isEmpty()) {
            log.warn("url为空，无法更新");
            throw new ParamException(ResultCode.BAD_REQUEST, "目标地址不存在");
        }

        try {
            // 1. 先查询用户信息，获取旧的头像URL
            Merchant oldMerchant = this.lambdaQuery()
                    .eq(Merchant::getOpenid, openid)
                    .one();

            if (oldMerchant == null) {
                log.warn("未找到对应的用户, openid: {}", openid);
                return "用户不存在";
            }

            String oldAvatarUrl = oldMerchant.getAvatarUrl();

            // 2. 更新用户的新头像URL
            boolean updated = this.lambdaUpdate()
                    .eq(Merchant::getOpenid, openid)
                    .set(Merchant::getAvatarUrl, url)
                    .update();

            if (updated) {
                log.info("成功更新用户url, openid: {}, 新url: {}", openid, url);

                // 3. 删除旧的头像文件（如果存在且不是默认头像）
                if (oldAvatarUrl != null && !oldAvatarUrl.isEmpty()) {
                    // 判断是否是默认头像，如果是默认头像就不删除
                    if (!isDefaultAvatar(oldAvatarUrl)) {
                        boolean deleted = cosStsService.deleteFile(oldAvatarUrl);
                        if (deleted) {
                            log.info("成功删除旧头像: {}", oldAvatarUrl);
                        } else {
                            log.warn("删除旧头像失败: {}", oldAvatarUrl);
                        }
                    } else {
                        log.info("旧头像为默认头像，不删除: {}", oldAvatarUrl);
                    }
                }

                return "上传成功";
            } else {
                log.warn("更新用户url失败, openid: {}", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, url);
            }
        } catch (Exception e) {
            log.error("更新用户url失败, openid: {}, url: {}", openid, url, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED,e);
        }
    }
    @Override
    public Boolean editNickname(String openid, String nickname) {
        // 1. 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法修改昵称");
           throw new ParamException(ResultCode.BAD_REQUEST,"未登录");
        }
        if (nickname == null || nickname.trim().isEmpty()) {
            log.warn("nickname为空，无法修改昵称");
           throw new ParamException(ResultCode.BAD_REQUEST,"修改后的昵称不能为空");
        }
        try {
            boolean updated = this.lambdaUpdate()
                    .eq(Merchant::getOpenid, openid)
                    .set(Merchant::getNickname, nickname)
                    .update();

            if (updated) {
                log.info("成功修改用户昵称, openid: {}, 新昵称: {}", openid, nickname);
                return true;
            } else {
                log.warn("修改用户昵称失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, nickname);
            }
        } catch (Exception e) {
            log.error("修改用户昵称异常, openid: {}, nickname: {}", openid, nickname, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED,e);
        }
    }
    @Override
    public Boolean editGender(String openid, String gender) {
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法修改性别");
            throw new ParamException(ResultCode.BAD_REQUEST,"未登录");
        }
        if ((!"0".equals(gender) && !"1".equals(gender) && !"2".equals(gender))) {
            log.warn("gender参数无效: {}, 有效值: 0(未知), 1(男), 2(女)", gender);
            throw new ParamException(ResultCode.BAD_REQUEST,"参数异常");
        }

        try {
            boolean updated = this.lambdaUpdate()
                    .eq(Merchant::getOpenid, openid)
                    .set(Merchant::getGender, gender)
                    .update();

            if (updated) {
                log.info("成功修改用户性别, openid: {}, 新性别: {}", openid,
                        "0".equals(gender) ? "未知" : ("1".equals(gender) ? "男" : "女"));
                return true;
            } else {
                log.warn("修改用户性别失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, gender);
            }

        } catch (Exception e) {
            log.error("修改用户性别异常, openid: {}, gender: {}", openid, gender, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED,e);
        }
    }
    @Override
    public Boolean editRegion(String openid, String province, String city) {
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法修改地区");
            throw new ParamException(ResultCode.BAD_REQUEST,"未登录");
        }
        if ((province == null || province.trim().isEmpty()) &&
                (city == null || city.trim().isEmpty())) {
            log.warn("province和city都为空，无法修改地区");
            throw new ParamException(ResultCode.BAD_REQUEST,"参数异常");
        }

        try {
            LambdaUpdateWrapper<Merchant> updateWrapper = new LambdaUpdateWrapper<>();
            updateWrapper.eq(Merchant::getOpenid, openid);

            if (province != null && !province.trim().isEmpty()) {
                updateWrapper.set(Merchant::getProvince, province);
            }
            if (city != null && !city.trim().isEmpty()) {
                updateWrapper.set(Merchant::getCity, city);
            }

            boolean updated = this.update(updateWrapper);

            if (updated) {
                log.info("成功修改用户地区, openid: {}, province: {}, city: {}",
                        openid,
                        province != null ? province : "不变",
                        city != null ? city : "不变");
                return true;
            } else {
                log.warn("修改用户地区失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED);
            }

        } catch (Exception e) {
            log.error("修改用户地区异常, openid: {}, province: {}, city: {}",
                    openid, province, city, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED,e);
        }
    }

    /*—————————————————————————————————————— 辅助方法 ——————————————————————————————————————*/
    private boolean isDefaultAvatar(String url) {
        String defaultAvatarUrl = "https://thirdwx.qlogo.cn" +
                "/mmopen/vi_32/POgEwh4mIHO4nibH0KlMECNjjGxQUq" +
                "24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icw" +
                "xaQX6grC9VemZoJ8rg/132";
        return url.contains("default")
                || url.contains("default-avatar")
                || url.startsWith("/images/default/")
                || defaultAvatarUrl.equals(url);
    }
}

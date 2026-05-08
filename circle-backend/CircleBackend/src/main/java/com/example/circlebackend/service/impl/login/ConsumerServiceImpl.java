package com.example.circlebackend.service.impl.login;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.entity.login.Consumer;
import com.example.circlebackend.entity.login.User;
import com.example.circlebackend.exception.ParamException;
import com.example.circlebackend.exception.ResultCode;
import com.example.circlebackend.exception.UserException;
import com.example.circlebackend.mapper.login.ConsumerMapper;
import com.example.circlebackend.service.CosStsService;
import com.example.circlebackend.service.login.ConsumerService;
import com.example.circlebackend.service.login.MerchantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ConsumerServiceImpl
        extends ServiceImpl<ConsumerMapper, Consumer>
        implements ConsumerService {

    /*————————————————————————————————————— 字段注入 —————————————————————————————————————*/
    @Autowired
    private MerchantService merchantService;
    @Autowired
    private CosStsService cosStsService;

    /*————————————————————————————————————— 保存用户 —————————————————————————————————————*/
    @Override
    public User saveConsumer(Consumer consumer) {
        isExist(consumer.getOpenid());
        this.save(consumer);
        return lambdaQuery()
                .eq(User::getOpenid, consumer.getOpenid())
                .one();
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

    /*———————————————————————————————————— 获取用户信息 ————————————————————————————————————*/
    @Override
    public List<User> getRandomConsumerList(String openid) {
        if (openid == null || openid.trim().isEmpty()) {
            throw new ParamException(ResultCode.BAD_REQUEST, "未登录");
        }
        try {
            List<Consumer> allUsers = this.lambdaQuery()
                    .ne(Consumer::getOpenid, openid)  // 排除当前用户
                    .list();

            if (allUsers == null || allUsers.isEmpty()) {
                log.info("没有找到其他用户，当前openid: {}", openid);
                return List.of();
            }

            // 如果其他用户总数小于等于5，直接返回所有其他用户
            if (allUsers.size() <= 5) {
                log.info("其他用户总数不足5个，返回全部 {} 个用户", allUsers.size());
                return new ArrayList<>(allUsers);
            }

            // 随机选取5个不重复的其他用户
            Collections.shuffle(allUsers); // 打乱顺序
            List<User> randomUsers = new ArrayList<>(allUsers.subList(0, 5));

            log.info("随机选取了 {} 个用户（已排除自己）", randomUsers.size());
            return randomUsers;

        } catch (Exception e) {
            log.error("获取随机用户列表失败, openid: {}", openid, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }
    @Override
    public List<User> getConsumerList() {
        try {
            List<Consumer> consumer = this.list();

            if (consumer == null || consumer.isEmpty()) {
                log.info("没有找到任何用户");
                return List.of();
            }

            log.info("成功查询到 {} 个用户", consumer.size());
            return new ArrayList<>(consumer);

        } catch (Exception e) {
            log.error("查询用户列表失败", e);
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }
    @Override
    public List<User> getConsumerList(List<String> openidList) {
        // 参数校验
        if (openidList == null || openidList.isEmpty()) {
            log.warn("openIdList为空，返回空列表");
            return List.of();
        }

        try {
            // 根据openid列表查询消费者
            List<Consumer> consumers = this.lambdaQuery()
                    .in(Consumer::getOpenid, openidList)
                    .list();

            List<User> merchants = merchantService.getMerchantsList(openidList);

            // 合并两个列表
            List<User> userList = new ArrayList<>();
            if (consumers != null && !consumers.isEmpty()) {
                userList.addAll(consumers);
            }
            if (merchants != null && !merchants.isEmpty()) {
                userList.addAll(merchants);
            }

            if (userList.isEmpty()) {
                log.info("未查询到任何用户，openIdList: {}", openidList);
                return List.of();
            }

            log.info("成功查询到 {} 个用户（消费者: {}, 商家: {}）",
                    userList.size(),
                    consumers == null ? 0 : consumers.size(),
                    merchants == null ? 0 : merchants.size());
            return userList;

        } catch (Exception e) {
            log.error("根据openIdList查询用户列表失败, openIdList: {}", openidList, e);
            throw new UserException(ResultCode.USER_QUERY_FAILED, e);
        }
    }
    @Override
    public List<String> getAllConsumerOpenid() {
        LambdaQueryWrapper<Consumer> wrapper = new LambdaQueryWrapper<>();
        wrapper.select(Consumer::getOpenid);
        List<Consumer> consumers = baseMapper.selectList(wrapper);
        return consumers.stream()
                .map(Consumer::getOpenid)
                .collect(Collectors.toList());
    }
    @Override
    public List<String> getUrl(List<String> openidList) {
        if (openidList == null || openidList.isEmpty()) {
            return new ArrayList<>();
        }

        return this.lambdaQuery()
                .select(Consumer::getAvatarUrl)
                .in(Consumer::getOpenid, openidList)
                .list()
                .stream()
                .map(Consumer::getAvatarUrl)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
    @Override
    public String getUrl(String openid) {
        if (openid == null || openid.trim().isEmpty()) {
            return "";
        }

        Consumer consumer = this.lambdaQuery()
                .select(Consumer::getAvatarUrl)
                .eq(Consumer::getOpenid, openid)
                .one();

        return consumer != null ? consumer.getAvatarUrl() : "";
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
            throw new ParamException(ResultCode.BAD_REQUEST, "图片地址丢失");
        }

        try {
            // 1. 先查询用户信息，获取旧的头像URL
            Consumer oldConsumer = this.lambdaQuery()
                    .eq(Consumer::getOpenid, openid)
                    .one();

            if (oldConsumer == null) {
                log.warn("未找到对应的用户, openid: {}", openid);
                throw new UserException(ResultCode.USER_NOT_FOUND, openid);
            }

            String oldAvatarUrl = oldConsumer.getAvatarUrl();

            // 2. 更新用户的新头像URL
            boolean updated = this.lambdaUpdate()
                    .eq(Consumer::getOpenid, openid)
                    .set(Consumer::getAvatarUrl, url)
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
                throw new UserException(ResultCode.USER_QUERY_FAILED, openid);
            }

        } catch (Exception e) {
            log.error("更新用户url失败, openid: {}, url: {}", openid, url, e);
            throw new UserException(ResultCode.DATA_UPDATE_FAILED, e);
        }
    }
    @Override
    public Boolean editNickname(String openid, String nickname) {
        // 1. 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法修改昵称");
            throw new ParamException(ResultCode.BAD_REQUEST, "未登录");
        }
        if (nickname == null || nickname.trim().isEmpty()) {
            log.warn("nickname为空，无法修改昵称");
            throw new ParamException(ResultCode.BAD_REQUEST, "不能输入空昵称");
        }
        try {
            boolean updated = this.lambdaUpdate()
                    .eq(Consumer::getOpenid, openid)
                    .set(Consumer::getNickname, nickname)
                    .update();

            if (updated) {
                log.info("成功修改用户昵称, openid: {}, 新昵称: {}", openid, nickname);
                return true;
            } else {
                log.warn("修改用户昵称失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, openid);
            }

        } catch (Exception e) {
            log.error("修改用户昵称异常, openid: {}, nickname: {}", openid, nickname, e);
            throw new UserException(ResultCode.DATA_UPDATE_FAILED, e);
        }
    }
    @Override
    public Boolean editGender(String openid, String gender) {
        // 1. 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            log.warn("openid为空，无法修改性别");
            throw new ParamException(ResultCode.BAD_REQUEST, "未登录");
        }

        // 2. 校验性别值（微信标准："0"未知，"1"男，"2"女）
        if ((!"0".equals(gender) && !"1".equals(gender) && !"2".equals(gender))) {
            log.warn("gender参数无效: {}, 有效值: 0(未知), 1(男), 2(女)", gender);
            throw new ParamException(ResultCode.DATA_NOT_ALLOWED, "参数有误");
        }

        try {
            // 3. 使用 lambdaUpdate() 直接更新性别
            boolean updated = this.lambdaUpdate()
                    .eq(Consumer::getOpenid, openid)
                    .set(Consumer::getGender, gender)
                    .update();

            if (updated) {
                log.info("成功修改用户性别, openid: {}, 新性别: {}", openid,
                        "0".equals(gender) ? "未知" : ("1".equals(gender) ? "男" : "女"));
                return true;
            } else {
                log.warn("修改用户性别失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, openid);
            }

        } catch (Exception e) {
            log.error("修改用户性别异常, openid: {}, gender: {}", openid, gender, e);
            throw new UserException(ResultCode.DATA_UPDATE_FAILED, e);
        }
    }
    @Override
    public Boolean editRegion(String openid, String province, String city) {
        // 1. 参数校验
        if (openid == null || openid.trim().isEmpty()) {
            throw new ParamException(ResultCode.BAD_REQUEST, "未登录");
        }

        // 2. 校验省份和城市（至少有一个不为空）
        if ((province == null || province.trim().isEmpty()) &&
                (city == null || city.trim().isEmpty())) {
            log.warn("province和city都为空，无法修改地区");
            throw new ParamException(ResultCode.DATA_NOT_ALLOWED, "参数存在错误");
        }

        try {
            // 3. 构建更新条件
            LambdaUpdateWrapper<Consumer> updateWrapper = new LambdaUpdateWrapper<>();
            updateWrapper.eq(Consumer::getOpenid, openid);

            // 4. 动态设置要更新的字段（哪个不为空就更新哪个）
            if (province != null && !province.trim().isEmpty()) {
                updateWrapper.set(Consumer::getProvince, province);
            }
            if (city != null && !city.trim().isEmpty()) {
                updateWrapper.set(Consumer::getCity, city);
            }

            // 5. 执行更新
            boolean updated = this.update(updateWrapper);

            if (updated) {
                log.info("成功修改用户地区, openid: {}, province: {}, city: {}",
                        openid,
                        province != null ? province : "不变",
                        city != null ? city : "不变");
                return true;
            } else {
                log.warn("修改用户地区失败, openid: {}, 可能用户不存在", openid);
                throw new UserException(ResultCode.USER_QUERY_FAILED, openid);
            }

        } catch (Exception e) {
            log.error("修改用户地区异常, openid: {}, province: {}, city: {}",
                    openid, province, city, e);
            throw new UserException(ResultCode.DATA_UPDATE_FAILED, e);
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
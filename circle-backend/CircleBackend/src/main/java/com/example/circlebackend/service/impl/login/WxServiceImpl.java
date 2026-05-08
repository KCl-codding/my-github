package com.example.circlebackend.service.impl.login;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.circlebackend.dto.LoginDto;
import com.example.circlebackend.entity.login.Consumer;
import com.example.circlebackend.entity.login.Merchant;
import com.example.circlebackend.entity.login.User;
import com.example.circlebackend.mapper.login.UserMapper;
import com.example.circlebackend.service.login.ConsumerService;
import com.example.circlebackend.service.login.MerchantService;
import com.example.circlebackend.service.login.WxService;
import com.example.circlebackend.utils.AESDecryptUtil;
import com.example.circlebackend.utils.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class WxServiceImpl
        extends ServiceImpl<UserMapper, User>
        implements WxService {

    private static final String WX_SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
    private static final String MERCHANT_PREFIX = "merchant_";

    /*———————————————————————————————————— 字段注入 ————————————————————————————————————*/
    @Value("${wx.appid}")
    private String appid;
    @Value("${wx.secret}")
    private String secret; @Autowired
    private MerchantService merchantService;
    @Autowired
    private ConsumerService consumerService;
    @Autowired
    private JwtUtil jwtUtil;

    /*———————————————————————————————————— 登录逻辑 ————————————————————————————————————*/
    @Override
    public Map<String,Object> login(LoginDto loginDto) {
        try {
            log.info("========== 开始登录 ==========");
            log.info("接收到的code: {}", loginDto.getCode());

            // 1. 获取微信会话信息
            Map<String, String> wxSession = getSessionKey(loginDto.getCode());

            String sessionKey = wxSession.get("session_key");
            String openid = wxSession.get("openid");

            if (sessionKey == null || openid == null) {
                log.error("获取微信会话失败 - sessionKey: {}, openid: {}", sessionKey, openid);
                throw new IllegalArgumentException("获取微信会话失败");
            }

            log.info("获取微信会话成功 - openid: {}", openid);

            // 2. 解密用户数据
            String decryptedData = AESDecryptUtil.decryptWxData(
                    loginDto.getEncryptedData(),
                    sessionKey,
                    loginDto.getIv()
            );

            log.info("解密后的用户数据: {}", decryptedData);

            // 3. 解析用户信息
            Map<String, Object> userInfo = parseUserInfo(decryptedData);
            log.info("解析后的用户信息: {}", userInfo);

            Map<String, Object> wxUserInfo = new HashMap<>();
            if (loginDto.getType()==1){
                openid=MERCHANT_PREFIX+openid;
                userInfo.put("openId", openid);
                wxUserInfo.put("token", type_1(userInfo,openid));
                // 从数据库获取userInfo
                User dbUser = merchantService.isExist(openid);
                if (dbUser != null) {
                    userInfo = getUserInfoFromDb(dbUser);
                }
            }else {
                wxUserInfo.put("token", type_2(userInfo,openid));
                // 从数据库获取userInfo
                User dbUser = consumerService.isExist(openid);
                if (dbUser != null) {
                    userInfo = getUserInfoFromDb(dbUser);
                }
            }
            wxUserInfo.put("userInfo", userInfo);
            return wxUserInfo;
        } catch (Exception e) {
            log.error("登录失败", e);
            throw new RuntimeException("登录失败: " + e.getMessage(), e);
        }
    }
    private String type_1(Map<String, Object> userInfo, String openid) {
        User user = merchantService.isExist(openid);
        System.out.println(user==null);
        if (user != null) {
            return generateToken(user);
        }

        Merchant merchant = new Merchant();
        merchant.setOpenid(openid);

        merchant.setNickname(getStringValue(userInfo, "nickName"));

        // 性别处理
        Object gender = userInfo.get("gender");
        merchant.setGender(gender != null ? gender.toString() : "");

        merchant.setCity(getStringValue(userInfo, "city"));
        merchant.setProvince(getStringValue(userInfo, "province"));
        merchant.setCountry(getStringValue(userInfo, "country"));

        // 修正：微信返回的是 avatarUrl，不是 avatar_url
        merchant.setAvatarUrl(getStringValue(userInfo, "avatarUrl"));

        // 修正：微信返回的是 unionId，不是 unionid
        merchant.setUnionId(getStringValue(userInfo, "unionId"));

        log.info("构建的商家对象: openid={}, nickname={}", merchant.getOpenid(), merchant.getNickname());

        // 5. 保存商家信息
        User savedMerchant = merchantService.saveMerchant(merchant);
        log.info("保存商家成功，ID: {}", savedMerchant.getId());

        // 6. 生成token
        String token = generateToken(savedMerchant);
        log.info("生成token成功: {}", token);
        log.info("========== 登录成功 ==========");

        return token;
    }
    private String type_2(Map<String, Object> userInfo, String openid) {
        User user = consumerService.isExist(openid);
        System.out.println(user==null);
        if (user != null) {
            return generateToken(user);
        }

        Consumer consumer = new Consumer();
        consumer.setOpenid(openid);

        // 修正：微信返回的是 nickName，不是 nickname
        consumer.setNickname(getStringValue(userInfo, "nickName"));

        // 性别处理
        Object gender = userInfo.get("gender");
        consumer.setGender(gender != null ? gender.toString() : "");

        consumer.setCity(getStringValue(userInfo, "city"));
        consumer.setProvince(getStringValue(userInfo, "province"));
        consumer.setCountry(getStringValue(userInfo, "country"));

        // 修正：微信返回的是 avatarUrl，不是 avatar_url
        consumer.setAvatarUrl(getStringValue(userInfo, "avatarUrl"));

        // 修正：微信返回的是 unionId，不是 unionid
        consumer.setUnionId(getStringValue(userInfo, "unionId"));

        // 5. 保存商家信息
        User savedConsumer = consumerService.saveConsumer(consumer);

        // 6. 生成token
        String token = generateToken(savedConsumer);
        log.info("生成token成功: {}", token);
        log.info("========== 登录成功 ==========");

        return token;
    }

    /*———————————————————————————————————— 辅助方法 ————————————————————————————————————*/
    private Map<String, Object> getUserInfoFromDb(User user) {
        Map<String, Object> dbUserInfo = new HashMap<>();
        dbUserInfo.put("openId", user.getOpenid());
        dbUserInfo.put("nickName", user.getNickname());
        dbUserInfo.put("gender", user.getGender());
        dbUserInfo.put("city", user.getCity());
        dbUserInfo.put("province", user.getProvince());
        dbUserInfo.put("country", user.getCountry());
        dbUserInfo.put("avatarUrl", user.getAvatarUrl());
        dbUserInfo.put("unionId", user.getUnionId());
        return dbUserInfo;
    }
    public Map<String, String> getSessionKey(String code) {
        String url = String.format("%s?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
                WX_SESSION_URL, appid, secret, code);

        try {
            log.info("调用微信接口: {}", url);

            // 使用 RestTemplate 以 String 类型接收响应
            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<String> responseEntity = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    String.class
            );

            String responseBody = responseEntity.getBody();
            log.info("微信接口原始响应: {}", responseBody);

            Map<String, String> result = new HashMap<>();

            if (responseBody != null && !responseBody.isEmpty()) {
                // 手动解析JSON
                ObjectMapper mapper = new ObjectMapper();
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> responseMap = mapper.readValue(responseBody, Map.class);

                    // 检查是否有错误码
                    if (responseMap.containsKey("errcode")) {
                        Integer errcode = (Integer) responseMap.get("errcode");
                        String errmsg = (String) responseMap.get("errmsg");
                        log.error("微信接口返回错误: errcode={}, errmsg={}", errcode, errmsg);
                        throw new RuntimeException("微信接口错误: " + errmsg);
                    }

                    // 成功获取数据
                    if (responseMap.containsKey("openid")) {
                        result.put("openid", (String) responseMap.get("openid"));
                        result.put("session_key", (String) responseMap.get("session_key"));
                        log.info("成功获取session_key，openid: {}", responseMap.get("openid"));
                    } else {
                        log.error("微信接口返回数据异常: {}", responseBody);
                    }

                } catch (Exception e) {
                    // 如果不是JSON格式，可能是纯文本错误
                    log.error("解析微信响应失败，原始响应: {}", responseBody);
                    throw new RuntimeException("微信接口返回异常: " + responseBody);
                }
            }

            return result;

        } catch (Exception e) {
            log.error("调用微信接口异常", e);
            throw new RuntimeException("获取微信session_key失败: " + e.getMessage(), e);
        }
    }
    private Map<String, Object> parseUserInfo(String decryptedData) {
        // 使用Jackson解析JSON
        ObjectMapper mapper = new ObjectMapper();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = mapper.readValue(decryptedData, Map.class);
            return result;
        } catch (Exception e) {
            log.error("解析用户信息失败，数据: {}", decryptedData, e);
            throw new RuntimeException("解析用户信息失败", e);
        }
    }

    private String getStringValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : "";
    }
    private String generateToken(User user) {
        return jwtUtil.generateToken(user.getOpenid());
    }
}
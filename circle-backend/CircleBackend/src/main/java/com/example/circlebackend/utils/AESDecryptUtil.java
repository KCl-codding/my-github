package com.example.circlebackend.utils;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

public class AESDecryptUtil {

    /**
     * AES-CBC解密
     * @param encryptedData 加密数据
     * @param sessionKey 会话密钥（从小程序code获取）
     * @param iv 初始向量
     * @return 解密后的JSON字符串
     */
    public static String decryptWxData(String encryptedData, String sessionKey, String iv) {
        try {
            Base64.Decoder decoder = Base64.getDecoder();

            // 解密密钥
            byte[] keyBytes = decoder.decode(sessionKey);
            // 初始向量
            byte[] ivBytes = decoder.decode(iv);
            // 加密数据
            byte[] encryptedBytes = decoder.decode(encryptedData);

            // 设置密钥规范
            SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, "AES");
            IvParameterSpec ivParameterSpec = new IvParameterSpec(ivBytes);

            // 创建密码器
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivParameterSpec);

            // 解密
            byte[] decryptedBytes = cipher.doFinal(encryptedBytes);

            return new String(decryptedBytes, "UTF-8");
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("解密失败: " + e.getMessage());
        }
    }
}
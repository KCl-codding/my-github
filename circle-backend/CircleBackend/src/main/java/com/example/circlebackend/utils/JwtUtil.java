package com.example.circlebackend.utils;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    // JWT密钥（建议从配置文件中读取）
    @Value("${jwt.secret}")
    private String secret;

    // 过期时间（毫秒），默认7天
    @Value("${jwt.expiration:604800000}")
    private Long expiration;

    // Token前缀
    private static final String TOKEN_PREFIX = "Bearer ";

    /**
     * 生成Token（基于openId）
     */
    public String generateToken(String openId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("openId", openId);
        claims.put("type", "access_token");
        return generateToken(claims, openId);
    }

    /**
     * 生成Token（带额外信息）
     */
    public String generateToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        SecretKey key = getSecretKey();

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * 生成Refresh Token（更长的有效期）
     */
    public String generateRefreshToken(String openId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("openId", openId);
        claims.put("type", "refresh_token");

        // Refresh Token有效期30天
        Long refreshExpiration = expiration * 3;
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshExpiration);

        SecretKey key = getSecretKey();

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(openId)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * 从Token中获取openId
     */
    public String getOpenIdFromToken(String token) {
        Claims claims = parseToken(token);
        if (claims != null) {
            return claims.get("openId", String.class);
        }
        return null;
    }

    /**
     * 从Token中获取subject
     */
    public String getSubjectFromToken(String token) {
        Claims claims = parseToken(token);
        return claims != null ? claims.getSubject() : null;
    }

    /**
     * 验证Token是否有效
     */
    public Boolean validateToken(String token) {
        try {
            Claims claims = parseToken(token);
            if (claims == null) {
                return false;
            }
            // 检查是否过期
            return !isTokenExpired(claims);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 验证Token并获取用户信息
     */
    public Claims verifyToken(String token) throws JwtException {
        try {
            SecretKey key = getSecretKey();
            return Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (ExpiredJwtException e) {
            throw new JwtException("Token已过期", e);
        } catch (UnsupportedJwtException e) {
            throw new JwtException("不支持的Token格式", e);
        } catch (MalformedJwtException e) {
            throw new JwtException("Token格式错误", e);
        } catch (SignatureException e) {
            throw new JwtException("Token签名验证失败", e);
        } catch (IllegalArgumentException e) {
            throw new JwtException("Token参数非法", e);
        }
    }

    /**
     * 解析Token
     */
    private Claims parseToken(String token) {
        try {
            // 移除Bearer前缀（如果存在）
            if (token.startsWith(TOKEN_PREFIX)) {
                token = token.substring(TOKEN_PREFIX.length());
            }

            SecretKey key = getSecretKey();
            return Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
        } catch (JwtException e) {
            return null;
        }
    }

    /**
     * 检查Token是否过期
     */
    private Boolean isTokenExpired(Claims claims) {
        Date expiration = claims.getExpiration();
        return expiration.before(new Date());
    }

    /**
     * 刷新Token
     */
    public String refreshToken(String oldToken) {
        try {
            String openId = getOpenIdFromToken(oldToken);
            if (openId != null) {
                return generateToken(openId);
            }
        } catch (Exception e) {
            // 刷新失败
        }
        return null;
    }

    /**
     * 获取签名密钥
     */
    private SecretKey getSecretKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 获取Token剩余有效时间（毫秒）
     */
    public Long getRemainingTime(String token) {
        Claims claims = parseToken(token);
        if (claims != null) {
            Date expiration = claims.getExpiration();
            long remaining = expiration.getTime() - System.currentTimeMillis();
            return remaining > 0 ? remaining : 0;
        }
        return 0L;
    }

    /**
     * 检查Token类型
     */
    public Boolean isRefreshToken(String token) {
        Claims claims = parseToken(token);
        if (claims != null) {
            String type = claims.get("type", String.class);
            return "refresh_token".equals(type);
        }
        return false;
    }
}
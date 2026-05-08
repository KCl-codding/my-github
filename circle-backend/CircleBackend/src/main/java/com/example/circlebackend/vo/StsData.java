package com.example.circlebackend.vo;

import lombok.Data;

@Data
public class StsData {
    private String tmpSecretId;
    private String tmpSecretKey;
    private String sessionToken;
    private Long startTime;
    private Long expiredTime;
}
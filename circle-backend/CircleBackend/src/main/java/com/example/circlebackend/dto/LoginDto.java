package com.example.circlebackend.dto;

import lombok.Data;

@Data
public class LoginDto {
    private String code;
    private String iv;
    private String encryptedData;
    private int type;
}

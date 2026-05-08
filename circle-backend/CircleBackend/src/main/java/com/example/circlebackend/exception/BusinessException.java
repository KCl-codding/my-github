package com.example.circlebackend.exception;

import lombok.Getter;

public class BusinessException extends RuntimeException {
    @Getter
    private Integer code; // 状态码
    private String message; // 错误信息

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }

    public BusinessException(Integer code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.message = message;
    }

    @Override
    public String getMessage() {
        return message;
    }
}
package com.example.circlebackend.exception;


import lombok.Getter;

@Getter
public enum ResultCode {
    // 成功
    SUCCESS(200, "成功"),

    // 客户端错误 4xx
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "禁止访问"),
    NOT_FOUND(404, "资源不存在"),

    // 业务错误 5xxx
    USER_NOT_FOUND(5001, "用户不存在"),
    USER_OPENID_EMPTY(5002, "openId不能为空"),
    USER_QUERY_FAILED(5003, "查询用户失败"),
    USER_ALREADY_EXIST(5004, "用户已存在"),

    DATA_UPDATE_FAILED(1001, "更新失败"),
    DATA_NOT_ALLOWED(1002, "参数存在错误"),

    // 系统错误 9xxx
    SYSTEM_ERROR(9999, "系统错误");

    private final Integer code;
    private final String message;

    ResultCode(Integer code, String message) {
        this.code = code;
        this.message = message;
    }
}
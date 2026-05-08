package com.example.circlebackend.utils;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {
    private Integer code;
    private String message;
    private T data;

    // 成功返回（无数据）
    public static <T> Result<T> success() {
        return new Result<>(200, "success", null);
    }

    // 成功返回（带数据）
    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    // 成功返回（自定义消息）
    public static <T> Result<T> success(String message, T data) {
        return new Result<>(200, message, data);
    }

    // 失败返回
    public static <T> Result<T> error(String message) {
        return new Result<>(500, message, null);
    }

    // 失败返回（自定义状态码）
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
}

package com.example.circlebackend.controller;

import com.example.circlebackend.entity.yard.Pay;
import com.example.circlebackend.entity.yard.Yard;
import com.example.circlebackend.service.yard.PayService;
import com.example.circlebackend.service.yard.YardService;
import com.example.circlebackend.utils.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/yard/")
public class YardController {

    @Autowired
    private YardService yardService;
    @Autowired
    private PayService payService;

    @PostMapping("save")
    public Result<Boolean> saveYard(@RequestBody Yard yard) {
        return Result.success(yardService.saveYard(yard));
    }
    @PostMapping("get_openid_yard")
    public Result<List<Yard>> getOpenIdYard(@RequestParam("openid") String openid) {
        return Result.success(yardService.getOpenidYards(openid));
    }
    @PostMapping("get_uuid_yard")
    public Result<Yard> getUuidYard(@RequestParam("uuid") String uuid) {
        return Result.success(yardService.getUuidYard(uuid));
    }
    @GetMapping("get_all_yard")
    public Result<List<Yard>> getAllYard(){
        return Result.success(yardService.getAllYards());
    }
    @GetMapping("get_four_yard")
    public Result<List<Yard>> getFourYard(){
        return Result.success(yardService.getFourYards());
    }
    @PostMapping("get_four_type_yard")
    public Result<List<Yard>> getFourYardByType(@RequestParam("type")String type) {
        return Result.success(yardService.getFourYardsByType(type));
    }

    @PostMapping("save_pays")
    public Result<Boolean> savePays(@RequestBody Pay pay) {
        return Result.success(payService.savePay(pay));
    }
    @PostMapping("delete_pays")
    public Result<Boolean> deletePays(@RequestParam("paysUuid") String paysUuid) {
        return Result.success(payService.deletePay(paysUuid));
    }
}

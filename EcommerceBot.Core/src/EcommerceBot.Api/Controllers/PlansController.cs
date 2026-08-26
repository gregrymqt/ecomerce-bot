using System;
using System.Threading.Tasks;
using EcommerceBot.Application.DTOs.Plans;
using EcommerceBot.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EcommerceBot.Api.Controllers;

[Route("api/v1/plans")]
public class PlansController : BaseApiController
{
    private readonly IPlanService _planService;

    public PlansController(IPlanService planService)
    {
        _planService = planService;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] bool onlyActive = false)
    {
        var plans = await _planService.GetAllPlansAsync(onlyActive);
        return Ok(plans);
    }

    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var plan = await _planService.GetPlanByIdAsync(id);
        if (plan == null) return NotFound();
        return Ok(plan);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create([FromBody] CreatePlanRequest request)
    {
        var plan = await _planService.CreatePlanAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = plan.Id }, plan);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePlanRequest request)
    {
        var plan = await _planService.UpdatePlanAsync(id, request);
        if (plan == null) return NotFound();
        return Ok(plan);
    }
}

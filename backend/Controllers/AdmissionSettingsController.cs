
using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("settings/admission-fee")]
public class AdmissionSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdmissionSettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // Get current admission fee
    [HttpGet]
    public async Task<IActionResult> GetFee()
    {
        var settings = await _context.AdmissionSettings
            .FirstOrDefaultAsync(x => x.Id == 1);

        return Ok(new
        {
            admissionFee = settings?.AdmissionFee ?? 0
        });
    }

    // Admin sets admission fee
    [HttpPut]
    public async Task<IActionResult> SetFee(
        [FromBody] AdmissionFeeRequest request)
    {
        if (request.AdmissionFee <= 0)
        {
            return BadRequest(new
            {
                message = "Admission fee must be greater than zero."
            });
        }

        var settings = await _context.AdmissionSettings
            .FirstOrDefaultAsync(x => x.Id == 1);

        if (settings == null)
        {
            settings = new AdmissionSettings
            {
                Id = 1,
                AdmissionFee = request.AdmissionFee
            };

            _context.AdmissionSettings.Add(settings);
        }
        else
        {
            settings.AdmissionFee = request.AdmissionFee;
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Admission fee updated successfully.",
            admissionFee = settings.AdmissionFee
        });
    }
}

public class AdmissionFeeRequest
{
    public decimal AdmissionFee { get; set; }
}

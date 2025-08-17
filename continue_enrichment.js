// Auto-continuation script for enrichment jobs
// Run this when an enrichment job indicates needs_continuation: true

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

async function checkAndContinueEnrichment(jobId) {
  try {
    // Check job status
    const statusResponse = await fetch(`${FUNCTIONS_URL}/job-status?job_id=${jobId}`);
    const jobStatus = await statusResponse.json();
    
    console.log(`Checking job ${jobId}:`, jobStatus.status);
    
    if (jobStatus.status === 'completed' && jobStatus.result?.needs_continuation) {
      console.log(`Job ${jobId} needs continuation. Starting new enrichment job...`);
      
      // Start new enrichment job
      const newJobResponse = await fetch(`${FUNCTIONS_URL}/enrich-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          continue_from: jobId
        })
      });
      
      const newJob = await newJobResponse.json();
      console.log(`Started continuation job:`, newJob.job_id);
      
      // Recursively check the new job after some time
      setTimeout(() => checkAndContinueEnrichment(newJob.job_id), 30000); // Check after 30 seconds
      
    } else if (jobStatus.status === 'running') {
      // Still running, check again later
      console.log(`Job ${jobId} still running, checking again in 60 seconds...`);
      setTimeout(() => checkAndContinueEnrichment(jobId), 60000);
      
    } else {
      console.log(`Job ${jobId} completed. Final status:`, jobStatus.result);
    }
    
  } catch (error) {
    console.error('Error checking job status:', error);
  }
}

// Usage: checkAndContinueEnrichment('your_job_id_here');

module.exports = { checkAndContinueEnrichment };
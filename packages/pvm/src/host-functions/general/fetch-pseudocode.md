/**
 * FETCH MODES PSEUDOCODE
 * 
 * Based on Gray Paper specification for Ω_Y (fetch function)
 * Each mode uses registers[10] as selector to determine what data to fetch
 */

// MODE 0: System Constants
function mode0_getSystemConstants() {
    // Gray Paper: registers[10] = 0
    // Returns: encode{all system constants}
    
    constants = {
        // Deposit constants (8 bytes each)
        itemDeposit: 10,           // Citemdeposit
        byteDeposit: 1,             // Cbytedeposit  
        baseDeposit: 100,           // Cbasedeposit
        
        // Core constants
        coreCount: 341,            // Ccorecount (2 bytes)
        epochLen: 600,             // Cepochlen (4 bytes)
        slotSeconds: 6,             // Cslotseconds (2 bytes)
        valCount: 1023,            // Cvalcount (2 bytes)
        
        // Time constants
        expungePeriod: 19200,      // Cexpungeperiod (4 bytes)
        maxLookupAnchorage: 14400, // Cmaxlookupanchorage (4 bytes)
        rotationPeriod: 10,        // Crotationperiod (2 bytes)
        assuranceTimeoutPeriod: 5, // Cassurancetimeoutperiod (2 bytes)
        
        // Gas constants (8 bytes each)
        reportAccGas: 10000000,    // Creportaccgas
        packageAuthGas: 50000000,   // Cpackageauthgas
        packageRefGas: 5000000000, // Cpackagerefgas
        blockAccGas: 3500000000,   // Cblockaccgas
        
        // History constants
        recentHistoryLen: 8,       // Crecenthistorylen (2 bytes)
        
        // Package constants
        maxPackageItems: 16,       // Cmaxpackageitems (2 bytes)
        maxPackageXts: 128,        // Cmaxpackagexts (2 bytes)
        maxBundleSize: 13791360,   // Cmaxbundlesize (4 bytes)
        maxPackageImports: 3072,   // Cmaxpackageimports (4 bytes)
        maxPackageExports: 3072,   // Cmaxpackageexports (4 bytes)
        
        // Report constants
        maxReportDeps: 8,          // Cmaxreportdeps (2 bytes)
        maxReportVarSize: 49152,   // Cmaxreportvarsize (4 bytes)
        
        // Ticket constants
        maxBlockTickets: 16,       // Cmaxblocktickets (2 bytes)
        ticketEntries: 2,          // Cticketentries (2 bytes)
        epochTailStart: 500,       // Cepochtailstart (4 bytes)
        
        // Authorization constants
        authPoolSize: 8,           // Cauthpoolsize (2 bytes)
        authQueueSize: 80,         // Cauthqueuesize (2 bytes)
        maxAuthCodeSize: 64000,    // Cmaxauthcodesize (4 bytes)
        
        // Service constants
        maxServiceCodeSize: 4000000, // Cmaxservicecodesize (4 bytes)
        
        // Segment constants
        ecPieceSize: 684,          // Cecpiecesize (4 bytes)
        segmentEcPieces: 6,        // Csegmentecpieces (4 bytes)
        
        // Transfer constants
        memoSize: 128              // Cmemosize (4 bytes)
    }
    
    return encodeConstants(constants) // Total: 200 bytes
}

// MODE 1: Work Package Hash
function mode1_getWorkPackageHash(refineContext) {
    // Gray Paper: n when n ≠ none ∧ registers[10] = 1
    // Returns: work package hash (32 bytes)
    
    if (!refineContext || !refineContext.workPackageHash) {
        return null // NONE
    }
    
    return refineContext.workPackageHash // 32-byte hash
}

// MODE 2: Authorizer Trace
function mode2_getAuthorizerTrace(refineContext) {
    // Gray Paper: r when r ≠ none ∧ registers[10] = 2
    // Returns: authorizer trace data
    
    if (!refineContext || !refineContext.authorizerTrace) {
        return null // NONE
    }
    
    return encode(refineContext.authorizerTrace)
}

// MODE 3: Export Segments
function mode3_getExportSegment(refineContext, segmentIndex) {
    // Gray Paper: x̄[registers[11]][registers[12]] when x̄ ≠ none ∧ registers[10] = 3
    // Returns: specific export segment
    
    if (!refineContext || !refineContext.exportSegments) {
        return null // NONE
    }
    
    exportSegments = refineContext.exportSegments
    segmentIdx = Number(segmentIndex)
    
    if (segmentIdx >= exportSegments.length) {
        return null // Out of bounds
    }
    
    return exportSegments[segmentIdx] // Uint8Array segment data
}

// MODE 4: Export Segments by Work Item
function mode4_getExportSegmentByWorkItem(refineContext, segmentIndex) {
    // Gray Paper: x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none ∧ registers[10] = 4
    // Returns: export segment for specific work item
    
    if (!refineContext || !refineContext.workItemIndex || !refineContext.exportSegments) {
        return null // NONE
    }
    
    workItemIdx = refineContext.workItemIndex
    segmentIdx = Number(segmentIndex)
    
    // Access exportSegments[workItemIdx][segmentIdx]
    if (workItemIdx >= refineContext.exportSegments.length) {
        return null
    }
    
    workItemExports = refineContext.exportSegments[workItemIdx]
    if (segmentIdx >= workItemExports.length) {
        return null
    }
    
    return workItemExports[segmentIdx]
}

// MODE 5: Import Segments
function mode5_getImportSegment(refineContext, segmentIndex, subIndex) {
    // Gray Paper: ī[registers[11]][registers[12]] when ī ≠ none ∧ registers[10] = 5
    // Returns: specific import segment
    
    if (!refineContext || !refineContext.importSegments) {
        return null // NONE
    }
    
    importSegments = refineContext.importSegments
    segmentIdx = Number(segmentIndex)
    subIdx = Number(subIndex)
    
    if (segmentIdx >= importSegments.length) {
        return null
    }
    
    segment = importSegments[segmentIdx]
    if (subIdx >= segment.length) {
        return null
    }
    
    return segment[subIdx]
}

// MODE 6: Import Segments by Work Item
function mode6_getImportSegmentByWorkItem(refineContext, segmentIndex) {
    // Gray Paper: ī[i][registers[11]] when ī ≠ none ∧ i ≠ none ∧ registers[10] = 6
    // Returns: import segment for specific work item
    
    if (!refineContext || !refineContext.workItemIndex || !refineContext.importSegments) {
        return null // NONE
    }
    
    workItemIdx = refineContext.workItemIndex
    segmentIdx = Number(segmentIndex)
    
    // Access importSegments[workItemIdx][segmentIdx]
    if (workItemIdx >= refineContext.importSegments.length) {
        return null
    }
    
    workItemImports = refineContext.importSegments[workItemIdx]
    if (segmentIdx >= workItemImports.length) {
        return null
    }
    
    return workItemImports[segmentIdx]
}

// MODE 7: Work Package
function mode7_getWorkPackage(refineContext) {
    // Gray Paper: encode(p) when p ≠ none ∧ registers[10] = 7
    // Returns: encoded work package
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    return encode(refineContext.workPackage)
}

// MODE 8: Work Package Auth Config
function mode8_getAuthConfig(refineContext) {
    // Gray Paper: p.authconfig when p ≠ none ∧ registers[10] = 8
    // Returns: work package authorization configuration
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    return workPackage.authConfig
}

// MODE 9: Work Package Auth Token
function mode9_getAuthToken(refineContext) {
    // Gray Paper: p.authtoken when p ≠ none ∧ registers[10] = 9
    // Returns: work package authorization token
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    return workPackage.authToken
}

// MODE 10: Work Package Context
function mode10_getWorkContext(refineContext) {
    // Gray Paper: encode(p.context) when p ≠ none ∧ registers[10] = 10
    // Returns: encoded work package context
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    return encode(workPackage.context)
}

// MODE 11: Work Items Summary
function mode11_getWorkItemsSummary(refineContext) {
    // Gray Paper: encode({S(w) | w ∈ p.workitems}) when p ≠ none ∧ registers[10] = 11
    // Returns: encoded summary of all work items
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    workItems = workPackage.workItems
    
    summaries = []
    for each workItem in workItems {
        summary = S(workItem) // S(w) = encode{serviceIndex, codeHash, gasLimits, counts, payloadLen}
        summaries.push(summary)
    }
    
    return encode(summaries)
}

// MODE 12: Specific Work Item
function mode12_getWorkItem(refineContext, itemIndex) {
    // Gray Paper: S(p.workitems[registers[11]]) when p ≠ none ∧ registers[10] = 12
    // Returns: summary of specific work item
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    workItems = workPackage.workItems
    itemIdx = Number(itemIndex)
    
    if (itemIdx >= workItems.length) {
        return null // Out of bounds
    }
    
    workItem = workItems[itemIdx]
    return S(workItem) // S(w) = encode{serviceIndex, codeHash, gasLimits, counts, payloadLen}
}

// MODE 13: Work Item Payload
function mode13_getWorkItemPayload(refineContext, itemIndex) {
    // Gray Paper: p.workitems[registers[11]].payload when p ≠ none ∧ registers[10] = 13
    // Returns: payload of specific work item
    
    if (!refineContext || !refineContext.workPackage) {
        return null // NONE
    }
    
    workPackage = refineContext.workPackage
    workItems = workPackage.workItems
    itemIdx = Number(itemIndex)
    
    if (itemIdx >= workItems.length) {
        return null // Out of bounds
    }
    
    workItem = workItems[itemIdx]
    return workItem.payload
}

// MODE 14: Work Items (Extrinsics)
function mode14_getWorkItems(refineContext) {
    // Gray Paper: encode(i) when i ≠ none ∧ registers[10] = 14
    // Returns: encoded work items (extrinsics)
    
    if (!refineContext || !refineContext.workItems) {
        return null // NONE
    }
    
    return encode(refineContext.workItems)
}

// MODE 15: Work Item by Index
function mode15_getWorkItemByIndex(refineContext, itemIndex) {
    // Gray Paper: encode(i[registers[11]]) when i ≠ none ∧ registers[10] = 15
    // Returns: encoded specific work item
    
    if (!refineContext || !refineContext.workItems) {
        return null // NONE
    }
    
    workItems = refineContext.workItems
    itemIdx = Number(itemIndex)
    
    if (itemIdx >= workItems.length) {
        return null // Out of bounds
    }
    
    workItem = workItems[itemIdx]
    return encode(workItem)
}

/**
 * MAIN FETCH FUNCTION PSEUDOCODE
 */
function fetch(context, refineContext) {
    // Extract parameters from registers
    selector = context.registers[10]    // Mode selector
    outputOffset = context.registers[7] // Memory output address
    fromOffset = context.registers[8]   // Data start offset
    length = context.registers[9]       // Maximum length to write
    
    // Validate gas
    if (context.gasCounter < 10) {
        return { resultCode: "OOG" }
    }
    
    context.gasCounter -= 10
    
    // Fetch data based on selector
    fetchedData = null
    switch (selector) {
        case 0:  fetchedData = mode0_getSystemConstants()
        case 1:  fetchedData = mode1_getWorkPackageHash(refineContext)
        case 2:  fetchedData = mode2_getAuthorizerTrace(refineContext)
        case 3:  fetchedData = mode3_getExportSegment(refineContext, context.registers[11])
        case 4:  fetchedData = mode4_getExportSegmentByWorkItem(refineContext, context.registers[11])
        case 5:  fetchedData = mode5_getImportSegment(refineContext, context.registers[11], context.registers[12])
        case 6:  fetchedData = mode6_getImportSegmentByWorkItem(refineContext, context.registers[11])
        case 7:  fetchedData = mode7_getWorkPackage(refineContext)
        case 8:  fetchedData = mode8_getAuthConfig(refineContext)
        case 9:  fetchedData = mode9_getAuthToken(refineContext)
        case 10: fetchedData = mode10_getWorkContext(refineContext)
        case 11: fetchedData = mode11_getWorkItemsSummary(refineContext)
        case 12: fetchedData = mode12_getWorkItem(refineContext, context.registers[11])
        case 13: fetchedData = mode13_getWorkItemPayload(refineContext, context.registers[11])
        case 14: fetchedData = mode14_getWorkItems(refineContext)
        case 15: fetchedData = mode15_getWorkItemByIndex(refineContext, context.registers[11])
        default: fetchedData = null
    }
    
    // Write result to memory
    if (fetchedData === null) {
        // Return NONE (2^64 - 1) for not found
        context.registers[7] = 2^64 - 1
    } else {
        // Calculate actual data to write
        actualLength = min(length, fetchedData.length - fromOffset)
        dataToWrite = fetchedData.slice(fromOffset, fromOffset + actualLength)
        
        // Write to memory
        context.ram.writeOctets(outputOffset, dataToWrite)
        
        // Return total length of fetched data
        context.registers[7] = fetchedData.length
    }
    
    return { resultCode: null } // Continue execution
}

/**
 * HELPER FUNCTION S(w) PSEUDOCODE
 * Used in modes 11 and 12 for work item summaries
 */
function S(workItem) {
    // Gray Paper: S(w) = encode{serviceIndex, codeHash, gasLimits, counts, payloadLen}
    
    return encode({
        serviceIndex: workItem.serviceIndex,        // 4 bytes
        codeHash: workItem.codeHash,               // 32 bytes
        refGasLimit: workItem.refGasLimit,         // 8 bytes
        accGasLimit: workItem.accGasLimit,         // 8 bytes
        exportCount: workItem.exportCount,         // 2 bytes
        importSegmentCount: workItem.importSegments.length, // 2 bytes
        extrinsicCount: workItem.extrinsics.length, // 2 bytes
        payloadLength: workItem.payload.length     // 4 bytes
    })
}

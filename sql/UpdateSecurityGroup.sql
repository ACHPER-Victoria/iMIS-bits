SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[ACHPER_UpdateSecurityGroup] 
     
AS
BEGIN
    SET NOCOUNT ON;

	exec asi_ProcessDynamicGroup @groupName=N'Group1',@userKey='E982D078-994A-4BF9-B424-1010E64097D4'
	exec asi_ProcessDynamicGroup @groupName=N'Group2',@userKey='E982D078-994A-4BF9-B424-1010E64097D4'
	exec asi_ProcessDynamicGroup @groupName=N'Group3',@userKey='E982D078-994A-4BF9-B424-1010E64097D4'

END
